# wording

## Overview

Small helpers for the English text shown to the user, shared by every package so messages read the same everywhere.

## Components

| Component | Description |
| --- | --- |
| [counted_noun.py](./counted_noun.py) | `CountedNoun` writes a noun in the singular or the plural after a count, e.g. `"3 images"`. |

## Examples

```python
from ovir_gui.wording import CountedNoun

CountedNoun("class", "classes").of(2)
```
