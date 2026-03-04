-- Compendium SurrealDB Schema
-- Apply with: surreal import --conn <url> --user <user> --pass <pass> --ns compendium --db compendium schema.surql

-- ─── Node table ──────────────────────────────────────────────────────────────

DEFINE TABLE node SCHEMAFULL;

DEFINE FIELD type       ON TABLE node TYPE string
    ASSERT $value INSIDE ['thought', 'belief', 'image', 'memory', 'conversation'];
DEFINE FIELD content    ON TABLE node TYPE string;
DEFINE FIELD components ON TABLE node TYPE array<string> DEFAULT [];
DEFINE FIELD embedding  ON TABLE node TYPE array<float>  DEFAULT [];
DEFINE FIELD status     ON TABLE node TYPE string
    ASSERT $value INSIDE ['pending', 'processed']
    DEFAULT 'pending';
DEFINE FIELD source     ON TABLE node TYPE string
    ASSERT $value INSIDE ['manual', 'voice', 'image', 'import'];
DEFINE FIELD created_at ON TABLE node TYPE datetime DEFAULT time::now();
DEFINE FIELD raw_media  ON TABLE node TYPE option<string>;

DEFINE INDEX idx_node_status  ON TABLE node COLUMNS status;
DEFINE INDEX idx_node_type    ON TABLE node COLUMNS type;
DEFINE INDEX idx_node_created ON TABLE node COLUMNS created_at;

-- ─── Edge table ──────────────────────────────────────────────────────────────

DEFINE TABLE edge SCHEMAFULL;

DEFINE FIELD from_node  ON TABLE edge TYPE record<node>;
DEFINE FIELD to_node    ON TABLE edge TYPE record<node>;
DEFINE FIELD relation   ON TABLE edge TYPE string
    ASSERT $value INSIDE [
        -- Logical
        'supports', 'contradicts', 'implies', 'requires',
        -- Taxonomic
        'is_a', 'is_part_of',
        -- Causal
        'causes', 'enables', 'prevents',
        -- Experiential
        'evokes', 'reframes', 'parallels',
        -- Generative
        'origin_of', 'responds_to'
    ];
DEFINE FIELD reasoning  ON TABLE edge TYPE string;
DEFINE FIELD status     ON TABLE edge TYPE string
    ASSERT $value INSIDE ['proposed', 'accepted', 'rejected']
    DEFAULT 'proposed';
DEFINE FIELD annotation ON TABLE edge TYPE option<string>;
DEFINE FIELD created_at ON TABLE edge TYPE datetime DEFAULT time::now();

DEFINE INDEX idx_edge_from     ON TABLE edge COLUMNS from_node;
DEFINE INDEX idx_edge_to       ON TABLE edge COLUMNS to_node;
DEFINE INDEX idx_edge_relation ON TABLE edge COLUMNS relation;
DEFINE INDEX idx_edge_status   ON TABLE edge COLUMNS status;
