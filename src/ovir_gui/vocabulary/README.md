# vocabulary

## Overview

Text vocabulary of the classes to recognize: class definitions with their phrases (written `car: car, suv, taxi`), their order and colors, and the class list files and stores. The `workspace` package edits classes on top of it.

## Components

| Component | Description |
| --- | --- |
| [class_definition.py](./class_definition.py) | `ClassDefinition` is an output class and the text phrases querying it, written `car: car, suv, taxi`. |
| [class_list_file.py](./class_list_file.py) | `ClassListFile` reads and writes a plain-text class list with one class per line. |
| [class_list_store.py](./class_list_store.py) | `ClassListStore` remembers the class list of each task in the last run in a data directory. |
| [classes.py](./classes.py) | `ClassVocabulary` holds the ordered classes to detect, the index being the class id. |
| [colors.py](./colors.py) | `ClassColors` assigns distinct, stable colors to class ids for every view and annotated export. |
