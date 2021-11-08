# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
* The ability to export high resolution png images for publication quality in journals.
### Fixed
* Fixed panning and zooming when opening a new image in distance measuring mode [(#1665)](https://github.com/CARTAvis/carta-frontend/issues/1665).

## [3.0.0-beta.1b]

### Fixed
* Fixed crash caused by missing region length calculation.

## [3.0.0-beta.1]

### Added
* The image view toolbar can be minimized to prevent it from hiding the image view.
* The last used directory can now be preserved across CARTA sessions.
* The ability to view multiple images at once in a multi-panel view has been added.
* Boolean columns are now supported in FITS and VOTable catalogs.
* Line and poly-line regions can be created. They currently do not have any associated analytic features, but will be used for upcoming PV image features.
* Additional preferences added: smooth updates of the overlay and adjusting the visibility of the cursor overlay.
* The image, region and Stokes value can now be changed on the spatial profiler.
* Multiple images can now be loaded via query parameters, using `?files=[a,b,c]`.
* The Stokes value can be changed on statistics and histogram widgets.
* A cursor widget has been added, which displays the cursor position and value for all open images.
* An experimental JavaScript-based code snippets feature has been added, for scripting CARTA from the frontend. Snippets can be saved, edited and re-executed. The feature can be enabled in the preferences dialog.
* Added a customizable colorbar to the image view widget, with an interactive mode that highlights pixels above a threshold.
* A pixel grid is now displayed at high zoom levels. This can be disabled in the image view settings.
### Changed
* The image overlay title can now be customised on a per-image basis.
* The polarization string (e.g. "Stokes I") is shown instead of the index (e.g. 0).
* The spectral line query widget now checks the Splatalogue server before displaying.
* Optimisations to catalog rendering with a large number of data points.
* Directories displayed in the file browser now have item count and modified date entries. 
### Fixed
* Fixed issue with spectral-matched images not being refreshed [(#1571)](https://github.com/CARTAvis/carta-frontend/issues/1571).
* Fixed issue with image tiles smaller than 4x4 pixels ([#1365](https://github.com/CARTAvis/carta-frontend/issues/1365) and [#1485](https://github.com/CARTAvis/carta-frontend/issues/1485)).
* Fixed crash when region list is initially too small [(#1598)](https://github.com/CARTAvis/carta-frontend/issues/1598).
* Fixed region offset errors when matching and unmatching images [(#1293)](https://github.com/CARTAvis/carta-frontend/issues/1293).
* Fixes progress indicator when displaying multiple spectral profiles [(#1429)](https://github.com/CARTAvis/carta-frontend/issues/1429)
* Fixed minor input issues with the catalog widget ([#1505](https://github.com/CARTAvis/carta-frontend/issues/1505) and [#1544](https://github.com/CARTAvis/carta-frontend/issues/1544)).
* Fixed minor rendering issues on image edges [(#666)](https://github.com/CARTAvis/carta-frontend/issues/666).
* Fixed anchor rendering issue with rotated regions [(#1208)](https://github.com/CARTAvis/carta-frontend/issues/1208).
