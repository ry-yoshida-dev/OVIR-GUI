from enum import Enum

SMALL_AREA_LIMIT: float = 32.0**2
MEDIUM_AREA_LIMIT: float = 96.0**2


class SizeBand(Enum):
    """
    Object size by pixel area, with the bounds of the COCO evaluation: small below 32², medium below 96², large
    otherwise.
    """

    SMALL = "small"
    MEDIUM = "medium"
    LARGE = "large"

    @classmethod
    def of_area(cls, area: float) -> "SizeBand":
        """
        Band of an object.

        Parameters
        ----------
        area : float
            Pixel count of a mask or area of a box.

        Returns
        -------
        SizeBand
            Band the area falls in.

        Raises
        ------
        ValueError
            If the area is negative.
        """
        if area < 0.0:
            raise ValueError(f"area must not be negative. got {area}")
        if area < SMALL_AREA_LIMIT:
            return cls.SMALL
        if area < MEDIUM_AREA_LIMIT:
            return cls.MEDIUM
        return cls.LARGE
