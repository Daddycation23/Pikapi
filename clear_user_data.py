#!/usr/bin/env python3
"""
Script to clear MongoDB data for a specific user.
This will remove battle state and player profile for a specific user.
"""

import sys
import os
from pymongo import MongoClient
from bson import ObjectId

def clear_user_data(username):
    """Clear MongoDB data for a specific user."""
    try:
        # Connect to MongoDB (using same connection as the app)
        client = MongoClient('mongodb://localhost:27017/')
        db = client['pikapi']
        
        print(f"Looking for user: {username}")
        
        # Find the user first
        users_collection = db['users']
        user = users_collection.find_one({'username': username})
        
        if not user:
            print(f"❌ User '{username}' not found!")
            return False
        
        user_id = user['_id']
        print(f"Found user: {username} (ID: {user_id})")
        
        # Clear battle state
        battles_collection = db['battles']
        battle_result = battles_collection.delete_many({'user_id': user_id})
        print(f"Cleared {battle_result.deleted_count} battle states")
        
        # Clear player profile
        profiles_collection = db['player_profiles']
        profile_result = profiles_collection.delete_many({'_id': user_id})
        print(f"Cleared {profile_result.deleted_count} player profiles")
        
        print(f"\n✅ Successfully cleared data for user '{username}'!")
        print("The user account still exists but battle state and progress have been reset.")
        
    except Exception as e:
        print(f"❌ Error clearing user data: {e}")
        print("Make sure MongoDB is running and accessible.")
        return False
    
    return True

def list_users():
    """List all users in the database."""
    try:
        client = MongoClient('mongodb://localhost:27017/')
        db = client['pikapi']
        users_collection = db['users']
        
        users = list(users_collection.find({}, {'username': 1, '_id': 1}))
        
        if not users:
            print("No users found in the database.")
            return []
        
        print("Users in database:")
        for user in users:
            print(f"  - {user['username']} (ID: {user['_id']})")
        
        return users
        
    except Exception as e:
        print(f"❌ Error listing users: {e}")
        return []

def main():
    print("🧹 User Data Cleaner")
    print("This will clear battle state and player profile for a specific user.")
    print()
    
    # List existing users
    users = list_users()
    
    if not users:
        print("No users to clean. Exiting.")
        return
    
    print()
    username = input("Enter the username to clear data for: ").strip()
    
    if not username:
        print("❌ No username provided. Exiting.")
        return
    
    print(f"\n🚨 WARNING: This will clear battle state and player profile for user '{username}'!")
    print("The user account will remain but all progress will be lost.")
    
    # Ask for confirmation
    confirm = input("\nAre you sure you want to proceed? (yes/no): ").strip().lower()
    
    if confirm in ['yes', 'y']:
        if clear_user_data(username):
            print(f"\n🎉 Successfully cleared data for user '{username}'!")
            print("The user can now start fresh with their existing account.")
        else:
            print(f"\n❌ Failed to clear data for user '{username}'.")
            sys.exit(1)
    else:
        print("\n✅ Operation cancelled. No data was deleted.")

if __name__ == "__main__":
    main() 