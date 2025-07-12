# migrate_profiles_to_string_id.py
from pymongo import MongoClient

client = MongoClient("mongodb://localhost:27017/")  # Adjust if needed
db = client["pokemon_app"]  # Replace with your DB name
profiles = db["player_profiles"]

SESSION_FIELDS = [
    "current_level",
    "current_streak",
    "current_enemy_team",
    "current_enemy_team_id",
    "current_enemy_team_composition"
]

# 1. Migrate int _id profiles to string _id
for doc in profiles.find({"_id": {"$type": "int"}}):
    str_id = str(doc["_id"])
    if profiles.find_one({"_id": str_id}):
        print(f"String profile for {str_id} already exists, skipping or merging manually.")
        continue
    doc["_id"] = str_id
    profiles.insert_one(doc)
    profiles.delete_one({"_id": doc["_id"]})  # Remove the int _id version
    print(f"Migrated profile {str_id}")

# 2. Remove session fields from all string _id profiles
for doc in profiles.find({"_id": {"$type": "string"}}):
    unset_fields = {field: "" for field in SESSION_FIELDS if field in doc}
    if unset_fields:
        profiles.update_one({"_id": doc["_id"]}, {"$unset": unset_fields})
        print(f"Cleaned session fields from profile {doc['_id']}")

print("Migration and cleanup complete.")