"""
Network Field Mapper Service
Maps fields from different affiliate networks to database format
"""

import logging
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta
from utils.html_cleaner import clean_html_description, format_offer_name

logger = logging.getLogger(__name__)


class NetworkFieldMapper:
    """Maps network API fields to database fields"""
    
    # HasOffers field mapping
    HASOFFERS_MAPPING = {
        'id': 'campaign_id',
        'name': 'name',
        'description': 'description',
        'preview_url': 'preview_url',
        'default_payout': 'payout',
        'currency': 'currency',
        'status': 'status',
        'expiration_date': 'expiration_date',
    }
    
    # Status mapping
    STATUS_MAPPING = {
        'active': 'active',
        'paused': 'inactive',
        'pending': 'pending',
        'deleted': 'inactive',
        'expired': 'inactive',
    }
    
    # Country name to code mapping
    COUNTRY_NAME_TO_CODE = {
        'United States': 'US',
        'United Kingdom': 'GB',
        'Great Britain': 'GB',
        'England': 'GB',
        'Canada': 'CA',
        'Australia': 'AU',
        'Germany': 'DE',
        'France': 'FR',
        'Spain': 'ES',
        'Italy': 'IT',
        'Netherlands': 'NL',
        'Belgium': 'BE',
        'Switzerland': 'CH',
        'Austria': 'AT',
        'Sweden': 'SE',
        'Norway': 'NO',
        'Denmark': 'DK',
        'Finland': 'FI',
        'Poland': 'PL',
        'Ireland': 'IE',
        'Portugal': 'PT',
        'Greece': 'GR',
        'Czech Republic': 'CZ',
        'Hungary': 'HU',
        'Romania': 'RO',
        'Bulgaria': 'BG',
        'Croatia': 'HR',
        'Slovakia': 'SK',
        'Slovenia': 'SI',
        'Lithuania': 'LT',
        'Latvia': 'LV',
        'Estonia': 'EE',
        'Japan': 'JP',
        'China': 'CN',
        'South Korea': 'KR',
        'India': 'IN',
        'Singapore': 'SG',
        'Hong Kong': 'HK',
        'Taiwan': 'TW',
        'Thailand': 'TH',
        'Malaysia': 'MY',
        'Indonesia': 'ID',
        'Philippines': 'PH',
        'Vietnam': 'VN',
        'New Zealand': 'NZ',
        'Brazil': 'BR',
        'Mexico': 'MX',
        'Argentina': 'AR',
        'Chile': 'CL',
        'Colombia': 'CO',
        'Peru': 'PE',
        'South Africa': 'ZA',
        'Israel': 'IL',
        'Turkey': 'TR',
        'United Arab Emirates': 'AE',
        'Saudi Arabia': 'SA',
        'Egypt': 'EG',
        'Russia': 'RU',
        'Ukraine': 'UA',
    }
    
    # Payout type mapping
    PAYOUT_TYPE_MAPPING = {
        'cpa': 'CPA',
        'cpi': 'CPI',
        'cpl': 'CPL',
        'cps': 'CPS',
        'cpc': 'CPC',
        'cpm': 'CPM',
        'revshare': 'Revenue Share',
        'revenue_share': 'Revenue Share',
        'hybrid': 'Hybrid',
    }
    
    def map_to_db_format(self, offer_data: Dict, network_type: str = 'hasoffers', network_id: str = None) -> Dict[str, Any]:
        """
        Map network offer data to database format
        
        Args:
            offer_data: Raw offer data from network API
            network_type: Type of network ('hasoffers', 'cj', 'shareasale')
            network_id: Network identifier (e.g., 'cpamerchant')
            
        Returns:
            Dictionary with database field names
        """
        try:
            if network_type == 'hasoffers':
                return self._map_hasoffers_offer(offer_data, network_id)
            elif network_type == 'cj':
                return self._map_cj_offer(offer_data, network_id)
            elif network_type == 'shareasale':
                return self._map_shareasale_offer(offer_data, network_id)
            else:
                logger.error(f"Unsupported network type: {network_type}")
                return {}
        except Exception as e:
            logger.error(f"Error mapping offer data: {str(e)}", exc_info=True)
            return {}
    
    def _map_hasoffers_offer(self, offer_data: Dict, network_id: str = None) -> Dict[str, Any]:
        """Map HasOffers offer to database format"""
        try:
            # Extract Offer object
            offer = offer_data.get('Offer', {})
            
            # Use network_id if provided, otherwise default to 'HasOffers'
            network_name = network_id if network_id else 'HasOffers'
            
            # ENHANCEMENT 6: Format offer name
            raw_name = offer.get('name', '')
            formatted_name = format_offer_name(raw_name)
            
            # ENHANCEMENT 5: Clean HTML from description
            raw_description = offer.get('description', '')
            clean_description = clean_html_description(raw_description)
            
            # Basic mapping
            mapped = {
                'campaign_id': str(offer.get('id', '')),
                'name': formatted_name,  # Use formatted name
                'description': clean_description,  # Use cleaned description
                'preview_url': offer.get('preview_url', 'https://www.google.com'),
                'payout': float(offer.get('default_payout', 0)),
                'currency': offer.get('currency') or 'USD',  # Handle null currency
                'status': self._normalize_status(offer.get('status', 'active')),
                'network': network_name,  # Use actual network ID
            }
            
            # ENHANCEMENT 2: Extract payout type
            payout_type = (
                offer.get('payout_type') or 
                offer.get('type') or 
                offer.get('revenue_type') or 
                'cpa'
            )
            mapped['offer_type'] = self.PAYOUT_TYPE_MAPPING.get(str(payout_type).lower(), 'CPA')
            mapped['payout_model'] = mapped['offer_type']  # Add payout_model field
            
            # Handle tracking link - Use preview_url as target_url
            tracking_link = offer.get('preview_url') or 'https://example.com/offer'
            mapped['target_url'] = tracking_link
            
            logger.info(f"🔍 Mapping offer: {mapped['name']}")
            logger.info(f"   Campaign ID: {mapped['campaign_id']}")
            logger.info(f"   Target URL: {mapped['target_url']}")
            logger.info(f"   Payout: {mapped['payout']} {mapped['currency']}")
            logger.info(f"   Payout Type: {mapped['offer_type']}")
            logger.info(f"   Conversion Type: {mapped.get('conversion_type', 'Not provided')}")
            logger.info(f"   Device Targeting: {mapped.get('device_targeting', 'Not provided')}")
            logger.info(f"   Traffic Type: {mapped.get('traffic_type', 'Not provided')}")
            logger.info(f"   Conversion Window: {mapped.get('conversion_window', 'Not provided')}")
            logger.info(f"   Protocol: {mapped.get('tracking_protocol', 'Not provided')}")
            
            # Handle expiration date
            expiration = offer.get('expiration_date')
            if expiration and expiration != '0000-00-00':
                mapped['expiration_date'] = expiration
            else:
                # Default to 90 days from now
                mapped['expiration_date'] = (datetime.utcnow() + timedelta(days=90)).strftime('%Y-%m-%d')
            
            # Handle image URL
            thumbnail = offer_data.get('Thumbnail', {})
            if thumbnail and thumbnail.get('url'):
                mapped['image_url'] = thumbnail['url']
            else:
                mapped['image_url'] = ''
            
            # ENHANCEMENT 1: Handle countries with name-to-code mapping
            countries = self._extract_countries(offer_data, offer)
            mapped['countries'] = countries if countries else ['US']
            
            logger.info(f"   Countries: {mapped['countries']}")
            
            # ENHANCEMENT 3: Extract tracking protocol - Use ONLY real data
            protocol = offer.get('protocol') or offer.get('tracking_protocol')
            mapped['tracking_protocol'] = protocol if protocol else ''
            
            # ENHANCEMENT 4: Complete field mapping - Extract ALL available fields
            
            # Category/Vertical - Use real data or leave empty
            mapped['vertical'] = offer.get('category') or offer.get('vertical') or ''
            mapped['category'] = mapped['vertical']
            
            # Traffic and targeting - Use ONLY real data from API
            device_targeting = offer.get('device_targeting') or offer.get('devices')
            mapped['device_targeting'] = device_targeting if device_targeting else ''
            mapped['allowed_traffic_sources'] = offer.get('allowed_traffic_types') or []
            mapped['blocked_traffic_sources'] = offer.get('blocked_traffic_types') or []
            
            # Extract conversion type as separate field (NOT in description)
            conversion_type = (
                offer.get('conversion_type') or 
                offer.get('goal_type') or 
                offer.get('conversion_goal') or
                ''
            )
            mapped['conversion_type'] = conversion_type
            
            # Extract traffic type as separate field (NOT in description)
            traffic_type = (
                offer.get('traffic_type') or 
                offer.get('allowed_traffic') or
                ''
            )
            mapped['traffic_type'] = traffic_type
            
            # Conversion and tracking - Use ONLY real data from API
            mapped['conversion_flow'] = offer.get('conversion_flow') or ''
            conversion_window = offer.get('click_expiration_days') or offer.get('conversion_window')
            mapped['conversion_window'] = int(conversion_window) if conversion_window else None
            mapped['kpi'] = offer.get('kpi') or ''
            
            # Requirements and restrictions - Use ONLY real data
            mapped['restrictions'] = offer.get('restrictions') or ''
            mapped['creative_requirements'] = offer.get('creative_requirements') or ''
            mapped['terms_notes'] = offer.get('terms_and_conditions') or ''
            
            # Geo-targeting
            mapped['allowed_countries'] = offer.get('allowed_countries') or []
            mapped['blocked_countries'] = offer.get('blocked_countries') or []
            
            # Device and OS requirements
            mapped['os_requirements'] = offer.get('os_requirements') or []
            mapped['browser_requirements'] = offer.get('browser_requirements') or []
            mapped['carrier_requirements'] = offer.get('carrier_requirements') or []
            mapped['connection_type'] = offer.get('connection_type') or ''
            
            # Demographics
            mapped['language_requirements'] = offer.get('language_requirements') or []
            mapped['age_restrictions'] = offer.get('age_restrictions') or ''
            mapped['gender_targeting'] = offer.get('gender_targeting') or ''
            
            # Caps and limits
            mapped['daily_cap'] = offer.get('daily_cap') or 0
            mapped['monthly_cap'] = offer.get('monthly_cap') or 0
            
            # Set default values for required fields
            mapped['affiliates'] = 'all'
            mapped['revenue_share_percent'] = offer.get('revenue_share_percent') or 0
            
            # Extract incentive type from offer name or API field
            incentive_from_api = offer.get('incentive_type') or offer.get('incentive_allowed')
            if incentive_from_api:
                # Use API value if provided
                mapped['incentive_type'] = 'Incent' if str(incentive_from_api).lower() in ['true', '1', 'yes', 'incent'] else 'Non-Incent'
            else:
                # Fallback: Extract from offer name
                mapped['incentive_type'] = self._extract_incentive_type(offer.get('name', ''))
            
            # Handle terms and conditions - Use ONLY real data
            if offer.get('terms_and_conditions'):
                mapped['affiliate_terms'] = clean_html_description(offer['terms_and_conditions'])
            else:
                mapped['affiliate_terms'] = ''
            
            logger.info(f"✅ Successfully mapped offer: {mapped['name']}")
            
            return mapped
            
        except Exception as e:
            logger.error(f"Error mapping HasOffers offer: {str(e)}", exc_info=True)
            return {}
    
    def _extract_countries(self, offer_data: Dict, offer: Dict) -> List[str]:
        """
        Extract countries from offer data with name-to-code mapping
        
        Args:
            offer_data: Full offer data including Country object
            offer: Offer object itself
            
        Returns:
            List of country codes
        """
        countries = []
        country_data = offer_data.get('Country', {})
        
        # Debug: Print country data structure
        print(f"🌍 Extracting countries:")
        print(f"   Type: {type(country_data)}")
        
        if isinstance(country_data, dict):
            print(f"   Dict keys: {list(country_data.keys())}")
            for country_info in country_data.values():
                if isinstance(country_info, dict):
                    # Try to get code first
                    code = country_info.get('code')
                    if code:
                        countries.append(code.upper())
                        print(f"   ✅ Added country code: {code.upper()}")
                    else:
                        # Try to get from name
                        name = country_info.get('name')
                        if name:
                            code = self.COUNTRY_NAME_TO_CODE.get(name)
                            if code:
                                countries.append(code.upper())
                                print(f"   ✅ Mapped country name '{name}' to code: {code.upper()}")
                            else:
                                print(f"   ⚠️ Unknown country name: {name}")
        elif isinstance(country_data, list):
            print(f"   List length: {len(country_data)}")
            for country_info in country_data:
                if isinstance(country_info, dict):
                    code = country_info.get('code')
                    if code:
                        countries.append(code.upper())
                        print(f"   ✅ Added country code: {code.upper()}")
                    else:
                        name = country_info.get('name')
                        if name:
                            code = self.COUNTRY_NAME_TO_CODE.get(name)
                            if code:
                                countries.append(code.upper())
                                print(f"   ✅ Mapped country name '{name}' to code: {code.upper()}")
        
        # Also check if countries are in the Offer object itself
        offer_countries = offer.get('countries')
        if offer_countries:
            print(f"   Found countries in Offer object: {offer_countries}")
            if isinstance(offer_countries, list):
                for country in offer_countries:
                    if isinstance(country, str) and len(country) == 2:
                        countries.append(country.upper())
        
        # Check for allowed_countries field
        allowed_countries = offer.get('allowed_countries')
        if allowed_countries:
            print(f"   Found allowed_countries: {allowed_countries}")
            if isinstance(allowed_countries, list):
                for country in allowed_countries:
                    if isinstance(country, str) and len(country) == 2:
                        countries.append(country.upper())
        
        # Remove duplicates
        countries = list(set(countries))
        
        print(f"   Final countries: {countries}")
        
        return countries
    
    def _extract_incentive_type(self, offer_name: str) -> str:
        """
        Extract incentive type from offer name
        
        Args:
            offer_name: Offer name
            
        Returns:
            'Incent' or 'Non-Incent'
        """
        name_lower = offer_name.lower()
        if 'non incent' in name_lower or 'non-incent' in name_lower:
            return 'Non-Incent'
        elif 'incent' in name_lower:
            return 'Incent'
        else:
            return 'Incent'  # Default
    
    def _map_cj_offer(self, offer_data: Dict, network_id: str = None) -> Dict[str, Any]:
        """Map CJ offer to database format"""
        # TODO: Implement CJ mapping
        return {}
    
    def _map_shareasale_offer(self, offer_data: Dict, network_id: str = None) -> Dict[str, Any]:
        """Map ShareASale offer to database format"""
        # TODO: Implement ShareASale mapping
        return {}
    
    def _normalize_status(self, status: str) -> str:
        """Normalize status from different networks"""
        status_lower = str(status).lower()
        return self.STATUS_MAPPING.get(status_lower, 'active')
    
    def validate_mapped_offer(self, mapped_offer: Dict) -> tuple[bool, List[str]]:
        """
        Validate mapped offer has all required fields
        
        Returns:
            Tuple of (is_valid, list_of_errors)
        """
        errors = []
        required_fields = ['campaign_id', 'name', 'target_url', 'countries', 'payout', 'network']
        
        for field in required_fields:
            if field not in mapped_offer or not mapped_offer[field]:
                errors.append(f"Missing required field: {field}")
        
        # Validate payout is numeric
        if 'payout' in mapped_offer:
            try:
                float(mapped_offer['payout'])
            except (ValueError, TypeError):
                errors.append(f"Invalid payout value: {mapped_offer['payout']}")
        
        # Validate countries is a list
        if 'countries' in mapped_offer and not isinstance(mapped_offer['countries'], list):
            errors.append("Countries must be a list")
        
        return len(errors) == 0, errors


# Singleton instance
network_field_mapper = NetworkFieldMapper()
