#!/usr/bin/env python3
"""
Script to clean up expired payment plan dashboards
To be run as a cron job
"""

import requests
import os
from datetime import datetime

def cleanup_dashboards():
    """Call the cleanup endpoint to deactivate expired dashboards"""
    
    api_url = os.getenv('API_URL', 'http://localhost:8000')
    endpoint = f"{api_url}/api/dashboard/cleanup"
    
    try:
        response = requests.get(endpoint)
        
        if response.status_code == 200:
            data = response.json()
            print(f"[{datetime.now()}] Cleanup successful: {data['message']}")
        else:
            print(f"[{datetime.now()}] Cleanup failed with status: {response.status_code}")
            
    except Exception as e:
        print(f"[{datetime.now()}] Error during cleanup: {str(e)}")

if __name__ == "__main__":
    cleanup_dashboards()