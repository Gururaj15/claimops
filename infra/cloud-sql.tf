# Illustrative only — not applied. See infra/README.md.
resource "google_sql_database_instance" "claimops" {
  name             = "claimops-postgres"
  database_version = "POSTGRES_15"
  region           = "us-central1"

  settings {
    tier = "db-f1-micro" # right-size per tenant volume before real use
  }
}

resource "google_sql_database" "claimops_db" {
  name     = "claimops"
  instance = google_sql_database_instance.claimops.name
}
