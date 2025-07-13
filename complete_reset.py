#!/usr/bin/env python3
"""
Complete reset script to clear all data from the Pikapi application.
This will remove all MongoDB data, SQLite database, and provide instructions for browser cleanup.
"""

import os
import sys
from pymongo import MongoClient

def clear_sqlite_database():
    """Remove the SQLite database file."""
    db_file = 'pokemon.db'
    if os.path.exists(db_file):
        try:
            os.remove(db_file)
            print(f"✅ Removed SQLite database: {db_file}")
            return True
        except Exception as e:
            print(f"❌ Error removing SQLite database: {e}")
            return False
    else:
        print(f"ℹ️  SQLite database {db_file} does not exist")
        return True

def clear_all_mongodb_data():
    """Clear ALL MongoDB data including any collections we might have missed."""
    try:
        # Connect to MongoDB
        client = MongoClient('mongodb://localhost:27017/')
        db = client['pikapi']
        
        print("🔍 Scanning MongoDB collections...")
        
        # Get all collection names
        collection_names = db.list_collection_names()
        print(f"Found collections: {collection_names}")
        
        if not collection_names:
            print("ℹ️  No collections found in MongoDB")
            return True
        
        # Clear all collections
        total_deleted = 0
        for collection_name in collection_names:
            collection = db[collection_name]
            result = collection.delete_many({})
            total_deleted += result.deleted_count
            print(f"✅ Cleared {result.deleted_count} documents from '{collection_name}'")
        
        print(f"🗑️  Total documents deleted: {total_deleted}")
        
        # Drop all collections to be extra sure
        for collection_name in collection_names:
            db.drop_collection(collection_name)
            print(f"🗑️  Dropped collection: {collection_name}")
        
        print("✅ MongoDB completely cleared!")
        return True
        
    except Exception as e:
        print(f"❌ Error clearing MongoDB: {e}")
        return False

def clear_battle_data_only():
    """Clear only battle-related data from MongoDB, keeping user accounts."""
    try:
        # Connect to MongoDB
        client = MongoClient('mongodb://localhost:27017/')
        db = client['pikapi']
        
        print("🔍 Scanning for battle-related data...")
        
        # Collections that store battle data
        battle_collections = [
            'battles',          # Current battle states
            'player_profiles',  # Player levels, stats, team usage
            'battle_logs',      # Battle history logs (if any)
        ]
        
        total_cleared = 0
        
        for collection_name in battle_collections:
            if collection_name in db.list_collection_names():
                collection = db[collection_name]
                count = collection.count_documents({})
                
                if count > 0:
                    print(f"📋 Found {count} documents in '{collection_name}'")
                    
                    # Show sample data before clearing
                    sample = collection.find_one()
                    if sample:
                        print(f"   Sample data: {list(sample.keys())}")
                    
                    # Clear the collection
                    result = collection.delete_many({})
                    print(f"✅ Cleared {result.deleted_count} documents from '{collection_name}'")
                    total_cleared += result.deleted_count
                else:
                    print(f"ℹ️  No data in '{collection_name}'")
            else:
                print(f"ℹ️  Collection '{collection_name}' doesn't exist")
        
        print(f"\n🗑️  Total battle documents cleared: {total_cleared}")
        
        # Also check for any other collections that might contain battle data
        all_collections = db.list_collection_names()
        other_collections = [c for c in all_collections if c not in battle_collections and c not in ['users']]
        
        if other_collections:
            print(f"\n🔍 Found other collections: {other_collections}")
            for collection_name in other_collections:
                collection = db[collection_name]
                count = collection.count_documents({})
                if count > 0:
                    print(f"   {collection_name}: {count} documents")
                    sample = collection.find_one()
                    if sample:
                        print(f"   Sample: {list(sample.keys())}")
                    
                    # Ask if user wants to clear this too
                    clear_it = input(f"   Clear '{collection_name}'? (y/n): ").strip().lower()
                    if clear_it in ['y', 'yes']:
                        result = collection.delete_many({})
                        print(f"   ✅ Cleared {result.deleted_count} documents from '{collection_name}'")
                        total_cleared += result.deleted_count
        
        print(f"\n✅ Battle data clearing complete!")
        print(f"Total documents cleared: {total_cleared}")
        
        return True
        
    except Exception as e:
        print(f"❌ Error clearing battle data: {e}")
        return False

def show_current_user_info():
    """Show information about current users."""
    try:
        client = MongoClient('mongodb://localhost:27017/')
        db = client['pikapi']
        
        if 'users' in db.list_collection_names():
            users_collection = db['users']
            users = list(users_collection.find({}, {'username': 1, '_id': 1}))
            
            if users:
                print("\n👥 Current users in database:")
                for user in users:
                    print(f"   - {user['username']} (ID: {user['_id']})")
                    
                    # Check if this user has any battle data
                    battles_collection = db.get_collection('battles', codec_options=None)
                    profiles_collection = db.get_collection('player_profiles', codec_options=None)
                    
                    battle_count = battles_collection.count_documents({'user_id': user['_id']})
                    profile_count = profiles_collection.count_documents({'_id': user['_id']})
                    
                    print(f"     Battle states: {battle_count}")
                    print(f"     Player profiles: {profile_count}")
            else:
                print("\n👥 No users found in database")
        else:
            print("\n👥 No users collection found")
            
    except Exception as e:
        print(f"❌ Error checking user info: {e}")

def show_browser_cleanup_instructions():
    """Show instructions for clearing browser data."""
    print("\n" + "="*60)
    print("🌐 BROWSER CLEANUP REQUIRED")
    print("="*60)
    print("To complete the reset, you need to clear your browser data:")
    print()
    print("1. Open your browser's Developer Tools (F12)")
    print("2. Go to the Application/Storage tab")
    print("3. Clear the following:")
    print("   - Cookies (especially for localhost)")
    print("   - Local Storage")
    print("   - Session Storage")
    print("   - IndexedDB")
    print()
    print("OR use these keyboard shortcuts:")
    print("   - Chrome/Edge: Ctrl+Shift+Delete")
    print("   - Firefox: Ctrl+Shift+Delete")
    print("   - Safari: Cmd+Option+E")
    print()
    print("Make sure to select:")
    print("   ✅ Cookies and other site data")
    print("   ✅ Cached images and files")
    print("   ✅ Browsing history (optional)")
    print("="*60)

def restart_application_instructions():
    """Show instructions for restarting the application."""
    print("\n" + "="*60)
    print("🔄 RESTART APPLICATION")
    print("="*60)
    print("After clearing all data:")
    print()
    print("1. Stop the Flask application if it's running (Ctrl+C)")
    print("2. Run: python init_db.py")
    print("3. Run: python main.py")
    print("4. Open a new browser window/tab")
    print("5. Navigate to http://localhost:5000")
    print("6. Register a new account (if you cleared everything)")
    print("   OR login with existing account (if you only cleared battle data)")
    print("="*60)

def main():
    print("🧹 PIKAPI RESET TOOL")
    print("="*60)
    print("Choose what you want to reset:")
    print()
    print("1. 🔥 COMPLETE RESET - Delete everything")
    print("   - Remove SQLite database (pokemon.db)")
    print("   - Clear ALL MongoDB data (users, battles, profiles)")
    print("   - Requires new account registration")
    print()
    print("2. ⚔️  BATTLE DATA ONLY - Keep user accounts")
    print("   - Clear battle states and player profiles")
    print("   - Keep user accounts and teams")
    print("   - Reset to level 1 with existing account")
    print()
    print("3. ❌ Cancel")
    print("="*60)
    
    choice = input("Enter your choice (1/2/3): ").strip()
    
    if choice == '1':
        # Complete reset
        print("\n🔥 COMPLETE RESET SELECTED")
        print("⚠️  WARNING: This will delete ALL data permanently!")
        print("⚠️  All user accounts, teams, and progress will be lost!")
        print()
        
        confirm = input("Are you sure you want to proceed? (type 'RESET' to confirm): ").strip()
        
        if confirm != 'RESET':
            print("✅ Operation cancelled. No data was deleted.")
            return
        
        print("\n🚀 Starting complete reset...")
        print("-" * 40)
        
        # Step 1: Clear SQLite
        print("Step 1: Clearing SQLite database...")
        sqlite_success = clear_sqlite_database()
        
        # Step 2: Clear MongoDB
        print("\nStep 2: Clearing MongoDB data...")
        mongodb_success = clear_all_mongodb_data()
        
        # Step 3: Show browser cleanup instructions
        show_browser_cleanup_instructions()
        
        # Step 4: Show restart instructions
        restart_application_instructions()
        
        # Final status
        print("\n" + "="*60)
        if sqlite_success and mongodb_success:
            print("✅ COMPLETE RESET SUCCESSFUL!")
            print("Follow the browser cleanup and restart instructions above.")
        else:
            print("⚠️  RESET PARTIALLY COMPLETED")
            print("Some errors occurred. Check the output above.")
        print("="*60)
        
    elif choice == '2':
        # Battle data only
        print("\n⚔️  BATTLE DATA RESET SELECTED")
        print("This will clear all battle-related data from MongoDB:")
        print("- Battle states (current battles)")
        print("- Player profiles (levels, stats, team usage)")
        print("- Battle logs (if any)")
        print()
        print("⚠️  User accounts will NOT be deleted")
        print("⚠️  You will need to restart battles from level 1")
        print()
        
        # Show current user info
        show_current_user_info()
        
        # Ask for confirmation
        confirm = input("\nProceed with clearing battle data? (y/n): ").strip().lower()
        
        if confirm in ['y', 'yes']:
            print("\n🚀 Clearing battle data...")
            if clear_battle_data_only():
                print("\n🎉 Battle data cleared successfully!")
                print("You can now start fresh battles with existing accounts.")
                
                # Show browser cleanup instructions
                show_browser_cleanup_instructions()
                
                # Show restart instructions
                restart_application_instructions()
            else:
                print("\n❌ Failed to clear battle data.")
                sys.exit(1)
        else:
            print("\n✅ Operation cancelled.")
            
    elif choice == '3':
        print("\n✅ Operation cancelled.")
        
    else:
        print("\n❌ Invalid choice. Please run the script again.")

if __name__ == "__main__":
    main() 