## Motivation

In order to understand latent structures in biological data, design machine learning algorithms to search for those structures, and debug those models' outputs,
we need to be able to _see_ our data. Visualization tools can help.

The framework we use today to visualize our today is jupyter notebook calls to matplotlib or seaborn.
Writing code to generate each plot independently interrupts a user's ability to focus on what matters: interpreting their data.

This library provides an interface to generate interactive plots commonly used in genomics.
Once the data is loaded into the plot template, the configuration takes place in the browser, via the UI (rather than code).
