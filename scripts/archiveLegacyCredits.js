// This v2 reset/archive tool is retired: it must not touch multi-guild records.
console.error("This migration is retired. Version 3 copies legacy records automatically without clearing the original collections. See KETTLE_SETUP.md.");
process.exitCode = 1;
