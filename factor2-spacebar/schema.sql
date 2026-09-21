-- Logical integration contract only. Do not execute this file as a migration here.
CREATE TABLE SpacebarSecret (
    user_id TEXT PRIMARY KEY,
    mode TEXT NOT NULL CHECK (mode IN ('COUNT', 'RHYTHM')),
    scheme_version TEXT NOT NULL,
    argon2id_phc TEXT NOT NULL,
    expected_units INTEGER,
    threshold_ms INTEGER,
    tolerance_ms INTEGER,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL
);

-- Deliberately excluded: plaintext_pattern and raw_timestamps.