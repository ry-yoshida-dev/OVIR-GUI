# execution

## Overview

Running a loaded recognizer over mini-batches of pictures: `RecognizerSession` keeps one model loaded, `RecognitionOutcome` holds the results of each mini-batch, and `StreamPosition` tells a tracker whether the next picture continues its stream.

## Components

| Component | Description |
| --- | --- |
| [outcome.py](./outcome.py) | `RecognitionOutcome` holds the results of one mini-batch with what it cost. |
| [session.py](./session.py) | `RecognizerSession` keeps one loaded model and reloads only when other weights are needed. |
| [stream_position.py](./stream_position.py) | `StreamPosition` tells whether the next picture continues the streaming session of a tracker. |
