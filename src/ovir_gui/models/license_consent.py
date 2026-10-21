from .licensed_dependency import LicensedDependency
from .recognition_model import RecognitionModel


class LicenseConsent:
    """
    Licensed modules the user agreed to use in compliance with their licenses.

    A model needing a licensed module cannot be chosen, and its module is never imported, until the user accepts the
    module's license.
    """

    def __init__(self, accepted: frozenset[LicensedDependency] = frozenset()) -> None:
        """
        Parameters
        ----------
        accepted : frozenset[LicensedDependency], optional
            Modules accepted in earlier runs; none by default.
        """
        self._accepted: set[LicensedDependency] = set(accepted)

    @property
    def accepted(self) -> frozenset[LicensedDependency]:
        """
        Accepted modules.

        Returns
        -------
        frozenset[LicensedDependency]
            Every module whose license the user accepted.
        """
        return frozenset(self._accepted)

    def accept(self, dependency: LicensedDependency) -> None:
        """
        Record that the user confirmed compliant use of a module and allowed it to be imported.

        Parameters
        ----------
        dependency : LicensedDependency
            Accepted module.

        Raises
        ------
        ModuleNotFoundError
            If the module is not installed.
        """
        self._ensure_installed(dependency)
        self._accepted.add(dependency)

    def is_accepted(self, dependency: LicensedDependency) -> bool:
        """
        Whether the user accepted the license of a module.

        Parameters
        ----------
        dependency : LicensedDependency
            Module to look up.

        Returns
        -------
        bool
            True once accepted.
        """
        return dependency in self._accepted

    def ensure_permitted(self, model: RecognitionModel) -> None:
        """
        Fail unless every licensed module a model needs is installed and accepted.

        Parameters
        ----------
        model : RecognitionModel
            Model about to be chosen.

        Raises
        ------
        ModuleNotFoundError
            If a needed module is not installed.
        PermissionError
            If the license of a needed module has not been accepted.
        """
        for dependency in sorted(model.licensed_dependencies, key=lambda entry: entry.value):
            self._ensure_installed(dependency)
            if dependency not in self._accepted:
                raise PermissionError(
                    f"{model.preset.label} needs {dependency.title} ({dependency.license_name}). "
                    + "Accept its license before choosing this model."
                )

    @staticmethod
    def _ensure_installed(dependency: LicensedDependency) -> None:
        if not dependency.is_installed:
            raise ModuleNotFoundError(
                f"{dependency.title} ({dependency.license_name}) is not installed. "
                + f"Install it with: {dependency.install_command}",
                name=dependency.module_name,
            )
