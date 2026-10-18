# vocabulary

## Overview

Text vocabulary of the classes to recognize. A `ClassDefinition` maps one output class to the phrases querying it (written `car: car, suv, taxi`), and a `ClassVocabulary` orders the classes so that the index is the class id. Class lists can be read from plain-text files and the list of the last run is remembered in the data directory. The `workspace` package edits classes on top of this vocabulary, and `storage` saves full class sets including reference images.

## Components

| Component | Description |
| --- | --- |
| [class_definition.py](./class_definition.py) | `ClassDefinition` is an output class and the text phrases querying it, written `car: car, suv, taxi`. |
| [class_list_file.py](./class_list_file.py) | `ClassListFile` reads and writes a plain-text class list with one class per line. |
| [class_list_store.py](./class_list_store.py) | `ClassListStore` remembers the class list of the last run in a data directory. |
| [class_vocabulary.py](./class_vocabulary.py) | `ClassVocabulary` holds the ordered classes to detect, the index being the class id. |
