-- Compendium SurrealDB Schema
-- Apply with: Get-Content schema.surql | surreal sql -e <url> --user <user> --pass <pass> --ns compendium --db compendium

DEFINE TABLE node SCHEMAFULL;
DEFINE FIELD type       ON TABLE node TYPE string;
DEFINE FIELD content    ON TABLE node TYPE string;
DEFINE FIELD components ON TABLE node TYPE array<string> DEFAULT [];
DEFINE FIELD embedding  ON TABLE node TYPE array<float>  DEFAULT [];
DEFINE FIELD status     ON TABLE node TYPE string DEFAULT 'pending';
DEFINE FIELD source     ON TABLE node TYPE string;
DEFINE FIELD created_at ON TABLE node TYPE datetime DEFAULT time::now();
DEFINE FIELD raw_media  ON TABLE node TYPE option<string>;
DEFINE INDEX idx_node_status  ON TABLE node COLUMNS status;
DEFINE INDEX idx_node_type    ON TABLE node COLUMNS type;
DEFINE INDEX idx_node_created ON TABLE node COLUMNS created_at;

DEFINE TABLE edge SCHEMAFULL;
DEFINE FIELD from_node  ON TABLE edge TYPE record<node>;
DEFINE FIELD to_node    ON TABLE edge TYPE record<node>;
DEFINE FIELD relation   ON TABLE edge TYPE string;
DEFINE FIELD reasoning  ON TABLE edge TYPE string;
DEFINE FIELD status     ON TABLE edge TYPE string DEFAULT 'proposed';
DEFINE FIELD annotation ON TABLE edge TYPE option<string>;
DEFINE FIELD created_at ON TABLE edge TYPE datetime DEFAULT time::now();
DEFINE INDEX idx_edge_from     ON TABLE edge COLUMNS from_node;
DEFINE INDEX idx_edge_to       ON TABLE edge COLUMNS to_node;
DEFINE INDEX idx_edge_relation ON TABLE edge COLUMNS relation;
DEFINE INDEX idx_edge_status   ON TABLE edge COLUMNS status;

DEFINE TABLE settings SCHEMAFULL;
DEFINE FIELD text_model   ON TABLE settings TYPE string DEFAULT 'llama3.2';
DEFINE FIELD vision_model ON TABLE settings TYPE string DEFAULT 'llava';
DEFINE FIELD embed_model  ON TABLE settings TYPE string DEFAULT 'nomic-embed-text';
