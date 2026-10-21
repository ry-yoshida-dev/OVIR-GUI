from collections.abc import Generator
from functools import partial
from queue import SimpleQueue
from threading import Thread

from PIL import Image

from ..media import FrameKey, KeyedPicture, PictureLoader
from ..models import RecognitionOutcome, RecognizerSession
from .inference_job import InferenceJob
from .inference_listener import InferenceListener
from .job_summary import JobSummary
from .task_scheduler import TaskScheduler


class InferenceEngine:
    """
    Runs recognition jobs on one worker thread, foreground jobs first and background jobs in between.

    The engine is used from the thread owning the workspace; its worker hands outcomes back through the
    ``TaskScheduler``. A foreground job (one the user asked for) runs one at a time and makes the engine busy from its
    request until it ends. A background job never makes the engine busy and always yields: it is refused while a
    foreground job is requested, and a foreground job requested while it runs interrupts it after the current
    mini-batch and starts right after. Jobs are processed in mini-batches of the model's batch size; results are
    reported per mini-batch, so a long video fills in as it is recognized.

    Call ``stop`` and then ``join`` before the application quits.
    """

    def __init__(
        self, scheduler: TaskScheduler, listener: InferenceListener, session: RecognizerSession | None = None
    ) -> None:
        """
        Parameters
        ----------
        scheduler : TaskScheduler
            Thread receiving the outcomes.
        listener : InferenceListener
            Receiver of the outcomes.
        session : RecognizerSession | None, optional
            Session keeping the loaded model; a new one by default.
        """
        self._scheduler: TaskScheduler = scheduler
        self._listener: InferenceListener = listener
        self._session: RecognizerSession = session or RecognizerSession()
        self._running_job: InferenceJob | None = None
        self._foreground_job: InferenceJob | None = None
        self._is_stopped: bool = False
        self._inbox: SimpleQueue[InferenceJob | None] = SimpleQueue()
        self._thread: Thread = Thread(target=self._work, name="inference-worker", daemon=True)
        self._thread.start()

    @property
    def is_busy(self) -> bool:
        """
        Whether a foreground job is requested or running.

        Returns
        -------
        bool
            True from a foreground request until it ends.
        """
        return self._foreground_job is not None

    @property
    def is_idle(self) -> bool:
        """
        Whether the worker has nothing to do.

        Returns
        -------
        bool
            True when no job runs or waits.
        """
        return self._running_job is None and self._foreground_job is None

    @property
    def running_job(self) -> InferenceJob | None:
        """
        Job the worker is processing.

        Returns
        -------
        InferenceJob | None
            ``None`` while the worker is idle.
        """
        return self._running_job

    @property
    def foreground_job(self) -> InferenceJob | None:
        """
        Foreground job requested or running.

        Returns
        -------
        InferenceJob | None
            ``None`` while no foreground job exists.
        """
        return self._foreground_job

    @property
    def session(self) -> RecognizerSession:
        """
        Session keeping the loaded model; touch it only from the worker.

        Returns
        -------
        RecognizerSession
            Session of the worker.
        """
        return self._session

    def submit(self, job: InferenceJob) -> bool:
        """
        Request a job.

        Parameters
        ----------
        job : InferenceJob
            Job to run.

        Returns
        -------
        bool
            True when the job was accepted; a background job is refused while another job runs or waits.

        Raises
        ------
        RuntimeError
            If a foreground job is requested while another foreground job exists.
        """
        if self._is_stopped:
            return False
        if not job.purpose.is_foreground:
            if self._running_job is not None or self._foreground_job is not None:
                return False
            self._send(job)
            return True
        if self._foreground_job is not None:
            raise RuntimeError("An inference is already running.")
        self._foreground_job = job
        self._listener.on_busy_changed(True)
        if self._running_job is None:
            self._send(job)
        else:
            self._running_job.control.interrupt()
        return True

    def interrupt_background(self) -> None:
        """
        Ask a running background job to yield after its current mini-batch.
        """
        if self._running_job is not None and not self._running_job.purpose.is_foreground:
            self._running_job.control.interrupt()

    def cancel(self) -> None:
        """
        Cancel the running and the waiting job, if any, after the current mini-batch.
        """
        if self._running_job is not None:
            self._running_job.control.cancel()
        if self._foreground_job is not None:
            self._foreground_job.control.cancel()

    def stop(self) -> None:
        """
        Cancel every job and ask the worker to quit after the current mini-batch, without waiting.
        """
        if self._is_stopped:
            return
        self._is_stopped = True
        self.cancel()
        self._inbox.put(None)

    def join(self) -> None:
        """
        Wait until the worker has quit; safe to call from any thread once ``stop`` was called.

        Raises
        ------
        RuntimeError
            If ``stop`` was not called first.
        """
        if not self._is_stopped:
            raise RuntimeError("stop must be called before join.")
        self._thread.join()

    def _send(self, job: InferenceJob) -> None:
        self._running_job = job
        self._inbox.put(job)

    def _on_activity(self, message: str) -> None:
        self._listener.on_activity(message)

    def _on_recognized(self, job: InferenceJob, frame_keys: tuple[FrameKey, ...], outcome: RecognitionOutcome) -> None:
        self._listener.on_recognized(job, frame_keys, outcome)

    def _on_progressed(self, job: InferenceJob) -> None:
        self._listener.on_progressed(job)

    def _on_finished(self, job: InferenceJob, summary: JobSummary) -> None:
        self._end(job)
        try:
            self._listener.on_finished(job, summary)
        finally:
            self._after_end(job)

    def _on_failed(self, job: InferenceJob, message: str) -> None:
        self._end(job)
        try:
            self._listener.on_failed(job, message)
        finally:
            self._after_end(job)

    def _end(self, job: InferenceJob) -> None:
        if self._running_job is job:
            self._running_job = None
        waiting_job: InferenceJob | None = self._foreground_job
        if waiting_job is not None and waiting_job is not job and self._running_job is None:
            self._send(waiting_job)

    def _after_end(self, job: InferenceJob) -> None:
        if self._foreground_job is job:
            self._foreground_job = None
            self._listener.on_busy_changed(False)

    def _dispatch_activity(self, message: str) -> None:
        self._scheduler.dispatch(partial(self._on_activity, message))

    def _work(self) -> None:
        while (job := self._inbox.get()) is not None:
            self._run(job)

    def _run(self, job: InferenceJob) -> None:
        if not self._session.is_loaded_for(job.model):
            self._dispatch_activity(f"Loading {job.model.weights_path} ...")
        total_count: int = len(job.frame_keys)
        recognized_count: int = 0
        unreadable_keys: list[FrameKey] = []
        batch_keys: list[FrameKey] = []
        batch_images: list[Image.Image] = []
        loader: PictureLoader = PictureLoader(dict(job.media))
        pictures: Generator[tuple[FrameKey, Image.Image | Exception]] = loader.load(job.frame_keys)
        try:
            for frame_key, picture in pictures:
                if job.control.is_stop_requested:
                    break
                if isinstance(picture, Exception):
                    unreadable_keys.append(frame_key)
                    job.control.advance(1)
                    continue
                batch_keys.append(frame_key)
                batch_images.append(picture)
                if len(batch_images) >= job.model.batch_size:
                    if not self._recognize(job, batch_keys, batch_images, total_count):
                        return
                    recognized_count += len(batch_keys)
                    batch_keys, batch_images = [], []
            if batch_images and not job.control.is_stop_requested:
                if not self._recognize(job, batch_keys, batch_images, total_count):
                    return
                recognized_count += len(batch_keys)
        except Exception as error:
            self._scheduler.dispatch(partial(self._on_failed, job, f"{type(error).__name__}: {error}"))
            return
        finally:
            pictures.close()
        is_stopped: bool = job.control.processed_count < total_count
        summary: JobSummary = JobSummary(
            recognized_count=recognized_count,
            unreadable_keys=tuple(unreadable_keys),
            is_cancelled=is_stopped and job.control.is_cancelled,
            is_interrupted=is_stopped and not job.control.is_cancelled,
        )
        self._scheduler.dispatch(partial(self._on_finished, job, summary))

    def _recognize(
        self, job: InferenceJob, frame_keys: list[FrameKey], images: list[Image.Image], total_count: int
    ) -> bool:
        first_number: int = job.control.processed_count + 1
        last_number: int = job.control.processed_count + len(frame_keys)
        span: str = frame_keys[0].label if len(frame_keys) == 1 else f"{frame_keys[0].label} … {frame_keys[-1].label}"
        self._dispatch_activity(f"Inferring {span} ({first_number}-{last_number}/{total_count}) ...")
        try:
            pictures: list[KeyedPicture] = [
                KeyedPicture(frame_key=frame_key, image=image)
                for frame_key, image in zip(frame_keys, images, strict=True)
            ]
            outcome: RecognitionOutcome = self._session.recognize(job.model, pictures, job.prompt)
        except Exception as error:
            message: str = f"{frame_keys[0].label}: {type(error).__name__}: {error}"
            self._scheduler.dispatch(partial(self._on_failed, job, message))
            return False
        job.control.advance(len(frame_keys))
        self._scheduler.dispatch(partial(self._on_recognized, job, tuple(frame_keys), outcome))
        self._scheduler.dispatch(partial(self._on_progressed, job))
        return True
