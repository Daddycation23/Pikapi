#!/usr/bin/env python3
"""
Script to clear all MongoDB data for a fresh start.
This will remove all user accounts, battle states, and player profiles.
"""

import sys
import os
from pymongo import MongoClient

def clear_mongodb():
    """Clear all MongoDB collections."""
    try:
        # Connect to MongoDB (using same connection as the app)
        client = MongoClient('mongodb://localhost:27017/')
        db = client['pikapi']
        
        print("Clearing MongoDB data...")
        
        # List all collections to clear
        collections_to_clear = [
            'users',           # User accounts
            'battles',         # Battle states
            'player_profiles'  # Player profiles and levels
        ]
        
        for collection_name in collections_to_clear:
            collection = db[collection_name]
            result = collection.delete_many({})
            print(f"Cleared {result.deleted_count} documents from '{collection_name}' collection")
        
        print("\n✅ MongoDB data cleared successfully!")
        print("You can now create a new account and start fresh.")
        
    except Exception as e:
        print(f"❌ Error clearing MongoDB: {e}")
        print("Make sure MongoDB is running and accessible.")
        return False
    
    return True

def main():
    print("🚨 WARNING: This will delete ALL user accounts, battle states, and player profiles!")
    print("This action cannot be undone.")
    
    # Ask for confirmation
    confirm = input("\nAre you sure you want to proceed? (yes/no): ").strip().lower()
    
    if confirm in ['yes', 'y']:
        if clear_mongodb():
            print("\n🎉 Fresh start complete! You can now register a new account.")
        else:
            print("\n❌ Failed to clear MongoDB data.")
            sys.exit(1)
    else:
        print("\n✅ Operation cancelled. No data was deleted.")

if __name__ == "__main__":
    main() 