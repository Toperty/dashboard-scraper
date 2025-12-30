"""
Google Sheets Reader Service
Reads data from Google Sheets for dashboard display
"""
import os
import json
from typing import Dict, Any, Optional
from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

class GoogleSheetsReader:
    """Service to read data from Google Sheets"""
    
    def __init__(self):
        """Initialize Google Sheets reader with credentials"""
        self.service = None
        self.credentials = None
        self._initialize_service()
    
    def _initialize_service(self):
        """Initialize Google Sheets API service"""
        try:
            # Get credentials from environment variables
            private_key = os.getenv('PRIVATE_KEY')
            client_email = os.getenv('CLIENT_EMAIL')
            
            if not private_key or not client_email:
                print("Google Sheets credentials not found in environment")
                return
            
            # Build credentials dictionary
            credentials_info = {
                "type": "service_account",
                "project_id": "alpine-shade-475114-r1",
                "private_key_id": "toperty-sheets-key",
                "private_key": private_key.replace('\\n', '\n'),
                "client_email": client_email,
                "client_id": "000000000000000000000",
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
                "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs"
            }
            
            # Create credentials object
            self.credentials = service_account.Credentials.from_service_account_info(
                credentials_info,
                scopes=['https://www.googleapis.com/auth/spreadsheets.readonly']
            )
            
            # Build the service
            self.service = build('sheets', 'v4', credentials=self.credentials)
            
        except Exception as e:
            print(f"Error initializing Google Sheets service: {e}")
    
    def read_sheet_data(self, sheet_id: str, ranges: list = None) -> Dict[str, Any]:
        """
        Read data from Google Sheets
        
        Args:
            sheet_id: Google Sheets document ID
            ranges: List of ranges to read (e.g., ['Flujo Toperty Interno!C8:C46', 'Para Envio Usuario!C3:C10'])
        
        Returns:
            Dictionary with sheet data
        """
        if not self.service:
            return {"error": "Google Sheets service not available"}
        
        try:
            # Default ranges if not specified
            if not ranges:
                ranges = [
                    'Flujo Toperty Interno!C8:C46',
                    'Para Envio Usuario!C3:C10'
                ]
            
            # Read multiple ranges at once
            result = self.service.spreadsheets().values().batchGet(
                spreadsheetId=sheet_id,
                ranges=ranges
            ).execute()
            
            value_ranges = result.get('valueRanges', [])
            
            # Parse the data
            data = {
                'flujo_interno': {},
                'para_usuario': {},
                'raw_data': value_ranges
            }
            
            # Parse Flujo Interno data if available
            if len(value_ranges) > 0 and 'values' in value_ranges[0]:
                flujo_values = value_ranges[0]['values']
                flujo_mapping = {
                    0: 'area',
                    1: 'commercial_value', 
                    2: 'average_purchase_value',
                    3: 'asking_price',
                    7: 'user_down_payment',
                    27: 'program_months',
                    38: 'potential_down_payment'
                }
                
                for idx, key in flujo_mapping.items():
                    if idx < len(flujo_values) and len(flujo_values[idx]) > 0:
                        data['flujo_interno'][key] = flujo_values[idx][0]
            
            # Parse Para Usuario data if available
            if len(value_ranges) > 1 and 'values' in value_ranges[1]:
                usuario_values = value_ranges[1]['values']
                usuario_mapping = {
                    0: 'client_name',
                    1: 'address',
                    2: 'city',
                    3: 'country',
                    4: 'construction_year',
                    5: 'stratum',
                    6: 'apartment_type',
                    7: 'private_parking'
                }
                
                for idx, key in usuario_mapping.items():
                    if idx < len(usuario_values) and len(usuario_values[idx]) > 0:
                        data['para_usuario'][key] = usuario_values[idx][0]
            
            # Also read calculated values (cash flow, payment schedule, etc.)
            cash_flow_range = 'Flujo Toperty Interno!E50:P100'  # Adjust range as needed
            cash_flow_result = self.service.spreadsheets().values().get(
                spreadsheetId=sheet_id,
                range=cash_flow_range
            ).execute()
            
            data['cash_flow'] = cash_flow_result.get('values', [])
            
            return data
            
        except HttpError as e:
            print(f"Error reading Google Sheets: {e}")
            return {"error": str(e)}
        except Exception as e:
            print(f"Unexpected error reading sheets: {e}")
            return {"error": str(e)}
    
    def get_payment_metrics(self, sheet_id: str) -> Dict[str, Any]:
        """
        Get specific payment metrics from the sheet
        
        Returns:
            Dictionary with key payment metrics
        """
        if not self.service:
            return {"error": "Google Sheets service not available"}
        
        try:
            # Read specific cells with calculated metrics
            ranges = [
                'Flujo Toperty Interno!C9',  # Commercial value
                'Flujo Toperty Interno!C11',  # Asking price
                'Flujo Toperty Interno!C15',  # User down payment
                'Flujo Toperty Interno!C35',  # Program months
                'Flujo Toperty Interno!C46',  # Potential down payment
                'Flujo Toperty Interno!I2',   # Bank mortgage rate
                'Flujo Toperty Interno!J2',   # Dupla bank rate
            ]
            
            result = self.service.spreadsheets().values().batchGet(
                spreadsheetId=sheet_id,
                ranges=ranges
            ).execute()
            
            value_ranges = result.get('valueRanges', [])
            
            metrics = {}
            metric_names = [
                'commercial_value',
                'asking_price', 
                'user_down_payment',
                'program_months',
                'potential_down_payment',
                'bank_mortgage_rate',
                'dupla_bank_rate'
            ]
            
            for idx, name in enumerate(metric_names):
                if idx < len(value_ranges) and 'values' in value_ranges[idx]:
                    values = value_ranges[idx]['values']
                    if len(values) > 0 and len(values[0]) > 0:
                        metrics[name] = values[0][0]
            
            return metrics
            
        except Exception as e:
            print(f"Error getting payment metrics: {e}")
            return {"error": str(e)}

# Singleton instance
google_sheets_reader = GoogleSheetsReader()