# Earth Online Location Data

The generated runtime index `earth-online-locations.v1.json` is derived from
[JetSetExpert/cities-json](https://github.com/JetSetExpert/cities-json), whose
data is sourced from the SimpleMaps World Cities Database.

The checked development-time source snapshot was commit
`e7c723e737c823b61d8c038849ab283573b2aa63`.

The source data is licensed under the Creative Commons Attribution 4.0
International license (CC BY 4.0):
https://creativecommons.org/licenses/by/4.0/

Earth Online keeps only a filtered subset and adds stable IDs, normalized
numeric fields, CLDR-backed Chinese country display names, and a small curated
set of Chinese province and major-city display names. The full source database
is used only at build time and is not committed or loaded at runtime.

The optional joelacus/world-cities dataset may be used for development-time
cross-checking. It is not bundled in the runtime index.
