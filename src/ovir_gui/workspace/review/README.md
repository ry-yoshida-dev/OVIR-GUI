# review

## Overview

How the user looks at the stored results: `ResultProfiles` switches the shown and compared profile and records which findings the user keeps, and `ReviewSettings` holds the criteria findings must pass (label mode of classifications, class minimums, duplicate suppression).

## Components

| Component | Description |
| --- | --- |
| [profiles.py](./profiles.py) | `ResultProfiles` switches the shown and compared result profile, forgets profiles and records which findings the user keeps. |
| [settings.py](./settings.py) | `ReviewSettings` keeps the label mode of classifications and the class minimums and duplicate suppression of every task, and remembers them. |
