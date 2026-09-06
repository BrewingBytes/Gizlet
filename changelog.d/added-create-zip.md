### Added

- **Create ZIP** bundles files, or a whole folder, into one standard archive on this device. Folder structure is kept, two files with the same path are numbered rather than one silently overwriting the other, and the order is yours to change before you build it. Each file is deflated with the browser's own compressor, or stored when compressing it would make it larger.

### Changed

- The ZIP writer now takes a deflated payload per entry as well as a stored one, so an archive of text is smaller while an archive of already-compressed pictures stays exactly as it was.
