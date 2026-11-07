from enum import Enum
from importlib.util import find_spec

from open_vocabulary_detector import DetectorBackend


class LicensedDependency(Enum):
    """
    Optional third-party module whose license restricts how the models depending on it may be used.

    Such a module is not installed with the GUI and is imported only after the user confirms that their use complies
    with its license.

    Attributes
    ----------
    ULTRALYTICS : str
        Ultralytics, running YOLO-World and YOLOE, licensed under AGPL-3.0.
    """

    ULTRALYTICS = "ultralytics"

    @classmethod
    def of_detector_backend(cls, backend: DetectorBackend) -> "LicensedDependency | None":
        """
        Licensed module a detector family is imported from.

        Parameters
        ----------
        backend : DetectorBackend
            Detector family.

        Returns
        -------
        LicensedDependency | None
            ``ULTRALYTICS`` for YOLO-World and YOLOE, ``None`` for families of permissive licenses.
        """
        match backend:
            case DetectorBackend.YOLO_WORLD | DetectorBackend.YOLOE:
                return cls.ULTRALYTICS
            case (
                DetectorBackend.GROUNDING_DINO
                | DetectorBackend.OWL_VIT
                | DetectorBackend.OMDET_TURBO
                | DetectorBackend.FLORENCE2
            ):
                return None

    @property
    def module_name(self) -> str:
        """
        Name the module is imported by.

        Returns
        -------
        str
            Top-level package name.
        """
        match self:
            case LicensedDependency.ULTRALYTICS:
                return "ultralytics"

    @property
    def title(self) -> str:
        """
        Human-readable name of the module.

        Returns
        -------
        str
            Display name.
        """
        match self:
            case LicensedDependency.ULTRALYTICS:
                return "Ultralytics"

    @property
    def license_name(self) -> str:
        """
        License the module and its model weights are distributed under.

        Returns
        -------
        str
            SPDX identifier of the license.
        """
        match self:
            case LicensedDependency.ULTRALYTICS:
                return "AGPL-3.0"

    @property
    def license_url(self) -> str:
        """
        Page describing the license terms of the module.

        Returns
        -------
        str
            URL of the license page.
        """
        match self:
            case LicensedDependency.ULTRALYTICS:
                return "https://www.ultralytics.com/license"

    @property
    def notice(self) -> str:
        """
        Terms the user must confirm before the module is imported.

        Returns
        -------
        str
            Plain-text notice shown in the confirmation dialog.
        """
        match self:
            case LicensedDependency.ULTRALYTICS:
                return (
                    "YOLO-World and YOLOE run on Ultralytics, which is licensed under AGPL-3.0; "
                    + "the model weights are distributed under AGPL-3.0 as well.\n\n"
                    + "You may use them only if your use complies with AGPL-3.0, which includes releasing the "
                    + "complete source code of any software or network service built on them under AGPL-3.0, "
                    + "or if you hold an Ultralytics Enterprise License.\n\n"
                    + "OVIR GUI does not grant you any license to Ultralytics or its model weights, and its authors "
                    + "accept no responsibility or liability for how you use them. You alone are responsible for "
                    + "complying with their license terms.\n\n"
                    + "By accepting, you confirm that your use complies with these terms, that you take full "
                    + "responsibility for it, and that the ultralytics module may be imported. Your acceptance is "
                    + "remembered in license_consent.json of the data directory; delete that file to withdraw it."
                )

    @property
    def install_command(self) -> str:
        """
        Command installing the module together with what the GUI needs from it.

        Returns
        -------
        str
            Shell command.
        """
        match self:
            case LicensedDependency.ULTRALYTICS:
                return "pip install 'ovir-gui[ultralytics]'"

    @property
    def is_installed(self) -> bool:
        """
        Whether the module can be imported, checked without importing it.

        Returns
        -------
        bool
            True when the module is found on the import path.
        """
        return find_spec(self.module_name) is not None
