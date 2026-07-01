"""
Network Field Mapper Service
Maps fields from different affiliate networks to database format
"""

import logging
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta
from utils.html_cleaner import clean_html_description, format_offer_name
from services.tracking_link_generator import process_offer_tracking_link

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
            network_type: Type of network ('hasoffers', 'everflow', 'mobplus', 'cj', 'shareasale')
            network_id: Network identifier (e.g., 'cpamerchant')
            
        Returns:
            Dictionary with database field names
        """
        try:
            if network_type == 'hasoffers':
                return self._map_hasoffers_offer(offer_data, network_id)
            elif network_type == 'everflow':
                return self._map_everflow_offer(offer_data, network_id)
            elif network_type == 'mobplus':
                return self._map_mobplus_offer(offer_data, network_id)
            elif network_type == 'adscendmedia':
                return self._map_adscendmedia_offer(offer_data, network_id)
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
                'payout': float(offer.get('default_payout', 0) or 0),
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
            
            # Handle tracking link - Generate proper tracking URL for known networks
            # HasOffers API may provide 'offer_url' or 'tracking_url' fields
            # For networks with tracking templates (leadads, cpamerchant, chameleonads),
            # we generate the full tracking link from the template
            raw_offer_url = (
                offer.get('offer_url') or 
                offer.get('tracking_url') or 
                offer.get('click_url') or
                ''
            )
            
            if raw_offer_url:
                # Use the actual tracking URL from the API if provided
                mapped['target_url'] = raw_offer_url
            else:
                # Try to generate tracking link using templates for known networks
                temp_offer_data = {
                    'network': network_name,
                    'campaign_id': str(offer.get('id', '')),
                    'target_url': ''  # placeholder
                }
                processed = process_offer_tracking_link(temp_offer_data, network_name)
                generated_url = processed.get('target_url', '')
                
                if generated_url:
                    # Template-generated tracking link (for leadads, cpamerchant, chameleonads etc.)
                    mapped['target_url'] = generated_url
                else:
                    # Fallback: use preview_url only as last resort
                    mapped['target_url'] = offer.get('preview_url') or 'https://example.com/offer'
            
            logger.debug(f"Mapping offer: {mapped['name']} (campaign: {mapped['campaign_id']})")
            
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
            mapped['countries'] = countries if countries else ['WW']
            
            # ENHANCEMENT 3: Extract tracking protocol - Use ONLY real data
            protocol = offer.get('protocol') or offer.get('tracking_protocol')
            mapped['tracking_protocol'] = protocol if protocol else ''
            
            # ENHANCEMENT 4: Complete field mapping - Extract ALL available fields
            
            # Category/Vertical - Use real data or auto-detect from name/description
            api_vertical = offer.get('category') or offer.get('vertical') or ''
            if api_vertical and api_vertical.lower() not in ['', 'lifestyle', 'general', 'other']:
                mapped['vertical'] = api_vertical
            else:
                # Auto-detect vertical from name and description
                from models.offer import detect_vertical_from_text
                offer_name = mapped.get('name', '')
                offer_description = mapped.get('description', '')
                mapped['vertical'] = detect_vertical_from_text(offer_name, offer_description)
            mapped['category'] = mapped['vertical']
            
            # Traffic and targeting - Use ONLY real data from API
            device_targeting = offer.get('device_targeting') or offer.get('devices')
            if not device_targeting:
                device_targeting = self._detect_device_from_name(offer.get('name', ''))
            mapped['device_targeting'] = device_targeting if device_targeting else 'all'
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
            
            # LEVEL-BASED PAYOUTS: Detect goals/conversion events from HasOffers API
            # HasOffers returns goals in offer_data.get('Goal', {}) or offer.get('goals', [])
            level_payouts = {'enabled': False, 'levels': []}
            goals_data = offer_data.get('Goal', {}) or offer_data.get('Goals', {})
            if isinstance(goals_data, dict) and goals_data:
                level_num = 1
                for goal_id, goal_info in goals_data.items():
                    if isinstance(goal_info, dict):
                        goal_name = goal_info.get('name', '') or goal_info.get('description', '') or f'Goal {level_num}'
                        goal_payout = float(goal_info.get('default_payout', 0) or goal_info.get('payout', 0) or 0)
                        goal_type = goal_info.get('payout_type', 'CPA') or 'CPA'
                        if goal_payout > 0:
                            level_payouts['levels'].append({
                                'level': level_num,
                                'name': goal_name,
                                'payout': goal_payout,
                                'type': goal_type.upper() if goal_type else 'CPA'
                            })
                            level_num += 1
            # Also check for goals as a list
            goals_list = offer.get('goals', []) or offer_data.get('goals', [])
            if isinstance(goals_list, list) and goals_list and not level_payouts['levels']:
                level_num = 1
                for goal in goals_list:
                    if isinstance(goal, dict):
                        goal_name = goal.get('name', '') or goal.get('description', '') or f'Goal {level_num}'
                        goal_payout = float(goal.get('payout', 0) or goal.get('default_payout', 0) or 0)
                        goal_type = goal.get('type', 'CPA') or 'CPA'
                        if goal_payout > 0:
                            level_payouts['levels'].append({
                                'level': level_num,
                                'name': goal_name,
                                'payout': goal_payout,
                                'type': goal_type.upper() if goal_type else 'CPA'
                            })
                            level_num += 1
            if level_payouts['levels']:
                level_payouts['enabled'] = True
            mapped['level_payouts'] = level_payouts
            
            # GEO-SPLIT PAYOUTS: Detect country-specific payouts from HasOffers API
            # HasOffers may return per-country payouts in Payout object or payout_per_country
            geo_payouts = []
            payout_data = offer_data.get('Payout', {}) or {}
            if isinstance(payout_data, dict):
                for country_id, payout_info in payout_data.items():
                    if isinstance(payout_info, dict):
                        country_code = payout_info.get('country_code', '') or payout_info.get('code', '')
                        country_payout = float(payout_info.get('amount', 0) or payout_info.get('payout', 0) or 0)
                        if country_code and len(country_code) == 2 and country_payout > 0:
                            geo_payouts.append({
                                'country': country_code.upper(),
                                'payout': country_payout,
                                'type': payout_info.get('payout_type', 'CPA') or 'CPA'
                            })
            # Also check for geo_payouts in the offer itself
            geo_payout_list = offer.get('geo_payouts', []) or offer.get('country_payouts', []) or offer_data.get('country_payouts', [])
            if isinstance(geo_payout_list, list) and geo_payout_list and not geo_payouts:
                for gp in geo_payout_list:
                    if isinstance(gp, dict):
                        cc = gp.get('country', '') or gp.get('country_code', '') or gp.get('geo', '')
                        amt = float(gp.get('payout', 0) or gp.get('amount', 0) or 0)
                        if cc and len(cc) == 2 and amt > 0:
                            geo_payouts.append({'country': cc.upper(), 'payout': amt, 'type': gp.get('type', 'CPA')})
            mapped['geo_payouts'] = geo_payouts
            
            # Generate tracking link for special networks (leadads, cpamerchant, chameleonads)
            # Pass network_id to identify the network since mapped data might not have it set yet
            mapped = process_offer_tracking_link(mapped, network_identifier=network_id)
            
            return mapped
            
        except Exception as e:
            logger.error(f"Error mapping HasOffers offer: {str(e)}", exc_info=True)
            return {}
    
    def _extract_countries(self, offer_data: Dict, offer: Dict) -> List[str]:
        """Extract countries from offer data with name-to-code mapping"""
        countries = []
        country_data = offer_data.get('Country', {})

        if isinstance(country_data, dict):
            for country_info in country_data.values():
                if isinstance(country_info, dict):
                    code = country_info.get('code')
                    if code:
                        countries.append(code.upper())
                    else:
                        name = country_info.get('name')
                        if name:
                            code = self.COUNTRY_NAME_TO_CODE.get(name)
                            if code:
                                countries.append(code.upper())
        elif isinstance(country_data, list):
            for country_info in country_data:
                if isinstance(country_info, dict):
                    code = country_info.get('code')
                    if code:
                        countries.append(code.upper())
                    else:
                        name = country_info.get('name')
                        if name:
                            code = self.COUNTRY_NAME_TO_CODE.get(name)
                            if code:
                                countries.append(code.upper())

        # Also check if countries are in the Offer object itself
        offer_countries = offer.get('countries')
        if offer_countries and isinstance(offer_countries, list):
            for country in offer_countries:
                if isinstance(country, str) and len(country) == 2:
                    countries.append(country.upper())

        # Check for allowed_countries field
        allowed_countries = offer.get('allowed_countries')
        if allowed_countries and isinstance(allowed_countries, list):
            for country in allowed_countries:
                if isinstance(country, str) and len(country) == 2:
                    countries.append(country.upper())

        # Check for geo field (some networks use this)
        geo = offer.get('geo') or offer.get('geos') or offer.get('targeting_geo')
        if geo:
            countries.extend(self._parse_geo_string(geo))

        # Check for country_targeting field
        country_targeting = offer.get('country_targeting') or offer.get('geo_targeting')
        if country_targeting:
            countries.extend(self._parse_geo_string(country_targeting))

        # Extract from offer name (e.g., "Offer Name - US, CA, UK")
        offer_name = offer.get('name', '')
        if offer_name:
            name_countries = self._extract_countries_from_text(offer_name)
            countries.extend(name_countries)

        # Extract from description (only if no countries found yet)
        description = offer.get('description', '')
        if description and not countries:
            desc_countries = self._extract_countries_from_text(description)
            countries.extend(desc_countries)

        # Remove duplicates
        countries = list(set(countries))

        # Handle GLOBAL/WORLDWIDE
        if not countries:
            text_to_check = f"{offer_name} {description}".lower()
            if 'global' in text_to_check or 'worldwide' in text_to_check or 'all geos' in text_to_check:
                countries = ['WW']

        return countries

    
    def _parse_geo_string(self, geo_value) -> List[str]:
        """Parse geo string/list into country codes"""
        countries = []
        
        if isinstance(geo_value, str):
            # Handle comma-separated string like "US, CA, UK" or "US,CA,UK"
            parts = geo_value.replace(' ', '').upper().split(',')
            for part in parts:
                if len(part) == 2 and part.isalpha():
                    countries.append(part)
                elif part in self.COUNTRY_NAME_TO_CODE.values():
                    countries.append(part)
        elif isinstance(geo_value, list):
            for item in geo_value:
                if isinstance(item, str):
                    if len(item) == 2 and item.isalpha():
                        countries.append(item.upper())
                    elif item in self.COUNTRY_NAME_TO_CODE:
                        countries.append(self.COUNTRY_NAME_TO_CODE[item])
                elif isinstance(item, dict):
                    code = item.get('code') or item.get('country_code')
                    if code:
                        countries.append(code.upper())
        
        return countries
    
    def _extract_countries_from_text(self, text: str) -> List[str]:
        """Extract country codes from offer name/description using STRICT patterns only.
        
        Only matches these safe, high-confidence patterns:
        1. Name-CC-Carrier (MobPlus: "Game Zone-KW-Ooredoo-MS-2Click")
        2. Brand_CC or Brand_CC_CC (Everflow: "Airpaz_WW", "JobScan_US_CA_AU_UK_DE")
        3. Brand [CC] (Bracketed: "Binance [CH]", "Spinarium [AR]")
        4. Brand - Platform - CC - CPI (Dash-separated: "Block Blast! - Android - TH - CPI")
        5. Brand CC at end (Last token: "Crocs FI", "KingOpinion_Survey CO")
        
        Does NOT match:
        - "My" → MY, "Select My Policy" → MY
        - "Incent OK" → anything
        - "RevShare" / "RS" suffix
        - ".co" / ".io" / ".com" domains
        - "AM"/"PM" from time formats
        - "TV" from product names (Sling TV, Fubo TV)
        - "Contractors" → CO
        """
        if not text:
            return []
        
        countries = []
        
        import re
        
        # Check for worldwide indicators first
        text_upper = text.upper()
        worldwide_patterns = [r'\bWW\b', r'\bWORLDWIDE\b', r'\bGLOBAL\b', r'\bALL\s*GEOS?\b', r'\bALL\s*COUNTRIES\b']
        for pattern in worldwide_patterns:
            if re.search(pattern, text_upper):
                countries.append('WW')
                break
        
        # Full ISO 3166-1 alpha-2 country codes
        ALL_ISO_CODES = {
            'AD','AE','AF','AG','AI','AL','AM','AO','AQ','AR','AS','AT','AU','AW','AX','AZ',
            'BA','BB','BD','BE','BF','BG','BH','BI','BJ','BL','BM','BN','BO','BQ','BR','BS','BT','BV','BW','BY','BZ',
            'CA','CC','CD','CF','CG','CH','CI','CK','CL','CM','CN','CO','CR','CU','CV','CW','CX','CY','CZ',
            'DE','DJ','DK','DM','DO','DZ',
            'EC','EE','EG','EH','ER','ES','ET',
            'FI','FJ','FK','FM','FO','FR',
            'GA','GB','GD','GE','GF','GG','GH','GI','GL','GM','GN','GP','GQ','GR','GS','GT','GU','GW','GY',
            'HK','HM','HN','HR','HT','HU',
            'ID','IE','IL','IM','IN','IO','IQ','IR','IS','IT',
            'JE','JM','JO','JP',
            'KE','KG','KH','KI','KM','KN','KP','KR','KW','KY','KZ',
            'LA','LB','LC','LI','LK','LR','LS','LT','LU','LV','LY',
            'MA','MC','MD','ME','MF','MG','MH','MK','ML','MM','MN','MO','MP','MQ','MR','MS','MT','MU','MV','MW','MX','MY','MZ',
            'NA','NC','NE','NF','NG','NI','NL','NO','NP','NR','NU','NZ',
            'OM',
            'PA','PE','PF','PG','PH','PK','PL','PM','PN','PR','PS','PT','PW','PY',
            'QA',
            'RE','RO','RS','RU','RW',
            'SA','SB','SC','SD','SE','SG','SH','SI','SJ','SK','SL','SM','SN','SO','SR','SS','ST','SV','SX','SY','SZ',
            'TC','TD','TF','TG','TH','TJ','TK','TL','TM','TN','TO','TR','TT','TV','TW','TZ',
            'UA','UG','UM','US','UY','UZ',
            'VA','VC','VE','VG','VI','VN','VU',
            'WF','WS',
            'XK',
            'YE','YT',
            'ZA','ZM','ZW',
            'UK','WW'
        }
        
        # STRICT false positives — codes that commonly appear in offer names but are NOT countries
        STRICT_FALSE_POSITIVES = {
            'OK', 'CC', 'AI', 'BE', 'AT', 'BY', 'IN', 'IS', 'IT', 'TO', 'ME',
            'NO', 'OR', 'SO', 'DO', 'AN', 'ON', 'UP',
            # Additional false positives identified from bad migration
            'AM', 'PM',  # Time formats (8AM-8PM)
            'TV',        # Product names (Sling TV, Fubo TV)
            'IO',        # Domain extensions (.io)
            'CO',        # Domain extensions (.co), "Contractors", "Company"
            'MY',        # "My" in English names
            'RS',        # "RevShare", "RS" suffix
            'MS',        # "Microsoft", "MS" abbreviation (except in MobPlus pattern)
        }
        
        # Extra false positives only for Pattern 5 (last-token) — more ambiguous context
        LAST_TOKEN_FALSE_POSITIVES = STRICT_FALSE_POSITIVES | {'US'}  # US at end is usually part of the name
        
        name_upper = text.upper()
        
        # Pattern 1: MobPlus style "Name-CC-Carrier"
        # e.g., "Game Zone-KW-Ooredoo-MS-2Click", "VIP Games-SA-Mobily-MS-2Click"
        mobplus_match = re.findall(r'-([A-Z]{2})-', name_upper)
        for code in mobplus_match:
            if code in ALL_ISO_CODES and code not in {'MS', 'OK', 'CC', 'AI'}:
                countries.append('GB' if code == 'UK' else code)
        
        # Pattern 2: Underscore-separated codes "Brand_CC" or "Brand_CC_CC_CC"
        # e.g., "Airpaz_WW", "JobScan_US_CA_AU_UK_DE", "Crocs_FI"
        underscore_match = re.findall(r'_([A-Z]{2})(?=_|$)', name_upper)
        for code in underscore_match:
            if code in ALL_ISO_CODES and code not in STRICT_FALSE_POSITIVES:
                countries.append('GB' if code == 'UK' else code)
        
        # Pattern 3: Bracketed codes "[CC]" or "[CC, CC]"
        # e.g., "Binance [CH]", "Spinarium [AR]", "Offer [US, CA]"
        bracket_match = re.findall(r'\[([A-Z]{2}(?:\s*,\s*[A-Z]{2})*)\]', name_upper)
        for match in bracket_match:
            codes = re.findall(r'[A-Z]{2}', match)
            for code in codes:
                if code in ALL_ISO_CODES and code not in STRICT_FALSE_POSITIVES:
                    countries.append('GB' if code == 'UK' else code)
        
        # Pattern 4: Dash-separated with country code as a standalone segment
        # e.g., "Block Blast! - Android - TH - CPI", "Doodle - CH"
        dash_segments = re.split(r'\s*[-–—]\s*', text)
        for segment in dash_segments:
            segment_stripped = segment.strip().upper()
            if len(segment_stripped) == 2 and segment_stripped.isalpha():
                if segment_stripped in ALL_ISO_CODES and segment_stripped not in STRICT_FALSE_POSITIVES:
                    countries.append('GB' if segment_stripped == 'UK' else segment_stripped)
        
        # Pattern 5: Last token is a 2-letter country code (space-separated)
        # e.g., "Crocs FI", "KingOpinion_Survey CO"
        # But NOT "Sling TV", "My App", "RevShare RS"
        tokens = text.strip().split()
        if len(tokens) >= 2:
            last_token = tokens[-1].upper()
            if len(last_token) == 2 and last_token.isalpha():
                if last_token in ALL_ISO_CODES and last_token not in LAST_TOKEN_FALSE_POSITIVES:
                    countries.append('GB' if last_token == 'UK' else last_token)
        
        return list(set(countries))
    
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
    
    def _detect_device_from_name(self, offer_name: str) -> str:
        """
        Detect device targeting from offer name.
        Looks for iOS/Android/Desktop keywords.
        
        Returns: 'ios', 'android', 'mobile', 'desktop', or 'all'
        """
        if not offer_name:
            return 'all'
        
        name_lower = offer_name.lower()
        
        has_ios = any(kw in name_lower for kw in ['ios', 'iphone', 'ipad', 'apple'])
        has_android = 'android' in name_lower
        has_desktop = any(kw in name_lower for kw in ['desktop', 'windows', 'mac os', 'macos'])
        
        if has_ios and has_android:
            return 'mobile'
        elif has_ios:
            return 'ios'
        elif has_android:
            return 'android'
        elif has_desktop:
            return 'desktop'
        else:
            return 'all'
    
    def _map_everflow_offer(self, offer_data: Dict, network_id: str = None) -> Dict[str, Any]:
        """Map Everflow offer to database format — based on real Everflow API response structure"""
        try:
            # network_id for Everflow is the API URL - extract a clean network name from it
            if network_id and ('http://' in network_id or 'https://' in network_id or 'eflow' in str(network_id).lower() or 'everflow' in str(network_id).lower()):
                # Force clean network name for known Everflow domains
                network_id_lower = str(network_id).lower()
                if 'eflow.team' in network_id_lower:
                    network_name = 'Adtogame'
                elif 'everflow' in network_id_lower:
                    network_name = 'Everflow'
                else:
                    try:
                        from urllib.parse import urlparse
                        parsed = urlparse(network_id)
                        domain = parsed.hostname or ''
                        clean_domain = domain.replace('api.', '').replace('www.', '')
                        parts = clean_domain.split('.')
                        network_name = parts[0].capitalize() if parts and parts[0] else 'Everflow'
                    except:
                        network_name = 'Everflow'
            else:
                network_name = network_id if network_id else 'Everflow'
            
            # Extract offer ID
            offer_id = str(offer_data.get('network_offer_id') or offer_data.get('offer_id') or offer_data.get('id') or '')
            
            # Extract name
            raw_name = offer_data.get('name') or ''
            formatted_name = format_offer_name(raw_name)
            
            # Extract description — Everflow uses html_description
            raw_description = offer_data.get('html_description') or offer_data.get('description') or ''
            clean_description = clean_html_description(raw_description)
            
            # Extract relationship object (contains payouts, countries, category, etc.)
            relationship = offer_data.get('relationship', {}) or {}
            
            # Extract payout from relationship.payouts.entries
            # For offers with multiple levels/events, use the highest non-zero payout as the main payout
            payout = 0.0
            payouts_data = relationship.get('payouts', {})
            if isinstance(payouts_data, dict):
                entries = payouts_data.get('entries', [])
                if entries and isinstance(entries, list):
                    # First try: find default payout with a non-zero amount
                    for entry in entries:
                        if entry.get('is_default', False):
                            try:
                                default_payout = float(entry.get('payout_amount', 0) or 0)
                                if default_payout > 0:
                                    payout = default_payout
                            except (ValueError, TypeError):
                                pass
                            break
                    
                    # If default payout is 0, use the highest non-zero payout from all entries
                    if payout == 0:
                        max_payout = 0
                        for entry in entries:
                            try:
                                entry_amt = float(entry.get('payout_amount', 0) or 0)
                                if entry_amt > max_payout:
                                    max_payout = entry_amt
                            except (ValueError, TypeError):
                                pass
                        payout = max_payout
            
            # Try payout_amount field directly (Everflow provides this as numeric)
            if payout == 0:
                try:
                    payout = float(offer_data.get('payout_amount', 0) or 0)
                except (ValueError, TypeError):
                    payout = 0
            
            if payout == 0:
                # Parse payout from string formats like "CPS 75.00%", "CPA: $26.250", or numeric
                raw_payout = offer_data.get('payout', 0)
                if isinstance(raw_payout, (int, float)):
                    payout = float(raw_payout)
                elif isinstance(raw_payout, str) and raw_payout:
                    import re
                    # Extract numeric value from strings like "CPA: $26.250", "CPS 75.00%", "$1.050"
                    num_match = re.search(r'[\$]?([\d]+\.?[\d]*)', raw_payout)
                    if num_match:
                        payout = float(num_match.group(1))
                    else:
                        payout = 0
                else:
                    payout = 0
            
            # Extract payout type from payouts entries or from payout string
            payout_type = 'cpa'
            raw_payout_str = str(offer_data.get('payout', ''))
            # First check the dedicated payout_type field from API
            api_payout_type = offer_data.get('payout_type', '')
            if api_payout_type:
                payout_type = api_payout_type.lower()
            elif 'CPS' in raw_payout_str.upper():
                payout_type = 'cps'
            elif 'CPL' in raw_payout_str.upper():
                payout_type = 'cpl'
            elif 'CPI' in raw_payout_str.upper():
                payout_type = 'cpi'
            elif 'CPA' in raw_payout_str.upper():
                payout_type = 'cpa'
            
            # Detect percentage-based payouts (revenue share)
            is_percentage = '%' in raw_payout_str
            payout_percentage_field = offer_data.get('payout_percentage', 0)
            if is_percentage and payout > 0:
                # This is a revenue share percentage, not a fixed amount
                mapped_revenue_share = payout  # e.g., 75.00
                payout = 0  # Fixed payout is 0 for percentage offers
            elif payout_percentage_field and float(payout_percentage_field) > 0:
                mapped_revenue_share = float(payout_percentage_field)
                payout = 0
            else:
                mapped_revenue_share = 0
            
            if isinstance(payouts_data, dict):
                entries = payouts_data.get('entries', [])
                if entries and isinstance(entries, list):
                    entry_type = entries[0].get('payout_type', '') or ''
                    if entry_type:
                        payout_type = entry_type
            
            # Extract currency
            currency = offer_data.get('currency_id') or offer_data.get('currency') or 'USD'
            # Everflow uses string currency codes like "EUR", "USD"
            if currency and str(currency).isdigit():
                currency = 'USD'  # Fallback for numeric IDs
            
            # Extract status
            offer_status = offer_data.get('offer_status') or offer_data.get('status') or 'active'
            if isinstance(offer_status, dict):
                offer_status = offer_status.get('name', 'active')
            
            # Extract tracking URL (this is the actual offer link to use)
            tracking_url = offer_data.get('tracking_url') or offer_data.get('redirect_tracking_url') or ''
            preview_url = offer_data.get('preview_url') or 'https://www.google.com'
            
            # Extract image/thumbnail
            image_url = offer_data.get('thumbnail_url') or ''
            # Also check relationship.thumbnail_asset for higher quality
            thumb_asset = relationship.get('thumbnail_asset', {})
            if isinstance(thumb_asset, dict) and thumb_asset.get('url'):
                image_url = thumb_asset['url']
            
            # Basic mapping
            mapped = {
                'campaign_id': offer_id,
                'name': formatted_name,
                'description': clean_description,
                'preview_url': preview_url,
                'payout': payout,
                'currency': currency.upper() if currency else 'USD',
                'status': self._normalize_status(str(offer_status)),
                'network': network_name,
                'target_url': tracking_url or preview_url,
                'image_url': image_url,
            }
            
            # Payout type / model
            mapped['offer_type'] = self.PAYOUT_TYPE_MAPPING.get(str(payout_type).lower(), 'CPA')
            mapped['payout_model'] = mapped['offer_type']
            
            # Expiration date — Everflow uses date_live_until
            expiration = offer_data.get('date_live_until') or offer_data.get('expiration_date') or ''
            if expiration and expiration not in ['0000-00-00', '', None]:
                mapped['expiration_date'] = str(expiration)[:10]
            else:
                mapped['expiration_date'] = (datetime.utcnow() + timedelta(days=90)).strftime('%Y-%m-%d')
            
            # Countries — from relationship.ruleset.countries[] with country_code field
            countries = []
            ruleset = relationship.get('ruleset', {})
            if isinstance(ruleset, dict):
                country_entries = ruleset.get('countries', [])
                if isinstance(country_entries, list):
                    for c in country_entries:
                        if isinstance(c, dict):
                            code = c.get('country_code', '')
                            targeting_type = c.get('targeting_type', 'include')
                            if code and targeting_type == 'include':
                                countries.append(code.upper())
            
            # Fallback: try top-level countries field
            if not countries:
                country_data = offer_data.get('countries') or offer_data.get('geo') or []
                if isinstance(country_data, list):
                    for c in country_data:
                        if isinstance(c, dict):
                            code = c.get('country_code') or c.get('code') or ''
                            if code:
                                countries.append(code.upper())
                        elif isinstance(c, str) and len(c) == 2:
                            countries.append(c.upper())
                elif isinstance(country_data, str):
                    countries = self._parse_geo_string(country_data)
            
            mapped['countries'] = countries if countries else ['WW']
            
            # Vertical / Category — from relationship.category.name
            api_vertical = ''
            category_data = relationship.get('category', {})
            if isinstance(category_data, dict):
                api_vertical = category_data.get('name', '')
            if not api_vertical:
                api_vertical = offer_data.get('category') or offer_data.get('vertical') or ''
            
            if api_vertical and api_vertical.lower() not in ['', 'lifestyle', 'general', 'other']:
                mapped['vertical'] = api_vertical
            else:
                from models.offer import detect_vertical_from_text
                mapped['vertical'] = detect_vertical_from_text(formatted_name, clean_description)
            mapped['category'] = mapped['vertical']
            
            # KPI — from relationship.requirement_kpis.entries[].kpi
            kpi_text = ''
            kpi_data = relationship.get('requirement_kpis', {})
            if isinstance(kpi_data, dict):
                kpi_entries = kpi_data.get('entries', [])
                if kpi_entries and isinstance(kpi_entries, list):
                    kpi_text = kpi_entries[0].get('kpi', '')
            mapped['kpi'] = kpi_text
            mapped['conversion_type'] = kpi_text  # KPI describes the conversion
            
            # Traffic type
            mapped['traffic_type'] = ''
            
            # Caps — from top-level fields
            mapped['daily_cap'] = int(offer_data.get('daily_conversion_cap', 0) or 0)
            mapped['monthly_cap'] = int(offer_data.get('monthly_conversion_cap', 0) or 0)
            
            # Device/Platform targeting — from relationship.ruleset.platforms[] or device_types[]
            platforms = []
            if isinstance(ruleset, dict):
                platform_entries = ruleset.get('platforms', [])
                if isinstance(platform_entries, list):
                    for p in platform_entries:
                        if isinstance(p, dict) and p.get('label'):
                            platforms.append(p['label'])
                
                # Fallback: Everflow also uses device_types[] with label field
                if not platforms:
                    device_type_entries = ruleset.get('device_types', [])
                    if isinstance(device_type_entries, list):
                        for dt in device_type_entries:
                            if isinstance(dt, dict) and dt.get('label'):
                                targeting_type = dt.get('targeting_type', 'include')
                                if targeting_type == 'include':
                                    platforms.append(dt['label'])
            mapped['device_targeting'] = ', '.join(platforms) if platforms else self._detect_device_from_name(offer_data.get('name', '') or offer_data.get('offer_name', ''))
            mapped['allowed_traffic_sources'] = []
            mapped['blocked_traffic_sources'] = []
            
            # Restrictions and terms
            mapped['restrictions'] = ''
            mapped['terms_notes'] = offer_data.get('terms_and_conditions') or ''
            
            # Geo targeting
            mapped['allowed_countries'] = countries
            mapped['blocked_countries'] = []
            
            # OS/Browser/Carrier from ruleset
            mapped['os_requirements'] = []
            mapped['browser_requirements'] = []
            mapped['carrier_requirements'] = []
            mapped['connection_type'] = ''
            
            # Demographics
            mapped['language_requirements'] = []
            mapped['age_restrictions'] = ''
            mapped['gender_targeting'] = ''
            
            # Defaults
            mapped['affiliates'] = 'all'
            mapped['revenue_share_percent'] = mapped_revenue_share if mapped_revenue_share > 0 else 0
            mapped['payout_type'] = 'percentage' if mapped_revenue_share > 0 else 'fixed'
            mapped['tracking_protocol'] = ''
            mapped['conversion_flow'] = ''
            mapped['conversion_window'] = None
            mapped['creative_requirements'] = ''
            mapped['affiliate_terms'] = offer_data.get('terms_and_conditions') or ''
            
            # Incentive type — check relationship.channels for "Incent" channel
            is_incent = False
            channels_data = relationship.get('channels', {})
            if isinstance(channels_data, dict):
                channel_entries = channels_data.get('entries', [])
                if isinstance(channel_entries, list):
                    for ch in channel_entries:
                        if isinstance(ch, dict) and 'incent' in (ch.get('name', '') or '').lower():
                            is_incent = True
                            break
            
            if is_incent:
                mapped['incentive_type'] = 'Incent'
            else:
                # Fallback: check name or terms
                terms = (offer_data.get('terms_and_conditions') or '').lower()
                if 'incent' in terms or 'incent' in raw_name.lower():
                    mapped['incentive_type'] = 'Incent'
                else:
                    mapped['incentive_type'] = self._extract_incentive_type(raw_name)
            
            # LEVEL-BASED PAYOUTS: Detect multiple payout entries from Everflow
            # Everflow can have multiple payout entries with different goals/events
            # Field mapping: entry_name (event name), payout_amount, payout_type, is_default
            level_payouts = {'enabled': False, 'levels': []}
            if isinstance(payouts_data, dict):
                entries = payouts_data.get('entries', [])
                if isinstance(entries, list) and len(entries) > 1:
                    # Multiple payout entries = level-based payouts (events)
                    level_num = 1
                    for entry in entries:
                        if isinstance(entry, dict):
                            # Everflow uses 'entry_name' for the event/level name
                            entry_name = entry.get('entry_name', '') or entry.get('name', '') or entry.get('goal_name', '') or f'Level {level_num}'
                            entry_payout = float(entry.get('payout_amount', 0) or 0)
                            entry_type = entry.get('payout_type', 'CPA') or 'CPA'
                            # Include ALL entries as levels, even $0 ones (they represent events/steps)
                            level_payouts['levels'].append({
                                'level': level_num,
                                'name': entry_name,
                                'payout': entry_payout,
                                'type': entry_type.upper() if entry_type else 'CPA'
                            })
                            level_num += 1
                    if level_payouts['levels']:
                        level_payouts['enabled'] = True
            # Also check goals from relationship
            goals_data = relationship.get('goals', {})
            if isinstance(goals_data, dict) and not level_payouts['levels']:
                goal_entries = goals_data.get('entries', [])
                if isinstance(goal_entries, list) and goal_entries:
                    level_num = 1
                    for goal in goal_entries:
                        if isinstance(goal, dict):
                            goal_name = goal.get('entry_name', '') or goal.get('name', '') or goal.get('description', '') or f'Goal {level_num}'
                            goal_payout = float(goal.get('payout_amount', 0) or goal.get('payout', 0) or 0)
                            goal_type = goal.get('payout_type', 'CPA') or 'CPA'
                            # Include all goals as levels
                            level_payouts['levels'].append({
                                'level': level_num,
                                'name': goal_name,
                                'payout': goal_payout,
                                'type': goal_type.upper() if goal_type else 'CPA'
                            })
                            level_num += 1
                    if level_payouts['levels']:
                        level_payouts['enabled'] = True
            mapped['level_payouts'] = level_payouts
            
            # GEO-SPLIT PAYOUTS: Detect country-specific payouts from Everflow
            # Everflow payouts.entries can have country-specific amounts
            geo_payouts = []
            if isinstance(payouts_data, dict):
                entries = payouts_data.get('entries', [])
                if isinstance(entries, list):
                    for entry in entries:
                        if isinstance(entry, dict):
                            # Check if entry has geo/country info
                            geo_targets = entry.get('geo_targets', []) or entry.get('countries', [])
                            entry_payout = float(entry.get('payout_amount', 0) or 0)
                            entry_type = entry.get('payout_type', 'CPA') or 'CPA'
                            if isinstance(geo_targets, list) and geo_targets and entry_payout > 0:
                                for gt in geo_targets:
                                    cc = ''
                                    if isinstance(gt, dict):
                                        cc = gt.get('country_code', '') or gt.get('code', '')
                                    elif isinstance(gt, str) and len(gt) == 2:
                                        cc = gt
                                    if cc and len(cc) == 2:
                                        geo_payouts.append({'country': cc.upper(), 'payout': entry_payout, 'type': entry_type.upper()})
            # Also check ruleset for geo-specific payouts
            if not geo_payouts and isinstance(ruleset, dict):
                geo_payout_rules = ruleset.get('geo_payouts', []) or ruleset.get('country_payouts', [])
                if isinstance(geo_payout_rules, list):
                    for gp in geo_payout_rules:
                        if isinstance(gp, dict):
                            cc = gp.get('country_code', '') or gp.get('country', '')
                            amt = float(gp.get('payout', 0) or gp.get('amount', 0) or 0)
                            if cc and len(cc) == 2 and amt > 0:
                                geo_payouts.append({'country': cc.upper(), 'payout': amt, 'type': gp.get('type', 'CPA')})
            mapped['geo_payouts'] = geo_payouts
            
            # Debug logging for level payouts and geo extraction
            if level_payouts.get('enabled'):
                logger.info(f"  → Offer '{formatted_name}' (ID: {offer_id}): {len(level_payouts['levels'])} level payouts detected: {[l['name'] for l in level_payouts['levels']]}")
            if countries and countries != ['WW']:
                logger.info(f"  → Offer '{formatted_name}' (ID: {offer_id}): {len(countries)} countries: {countries[:10]}{'...' if len(countries) > 10 else ''}")
            
            # Process tracking link for special networks
            mapped = process_offer_tracking_link(mapped, network_identifier=network_id)
            
            logger.debug(f"Mapped Everflow offer: {mapped['name']} (campaign: {mapped['campaign_id']})")
            return mapped
            
        except Exception as e:
            logger.error(f"Error mapping Everflow offer: {str(e)}", exc_info=True)
            return {}
    
    def _map_mobplus_offer(self, offer_data: Dict, network_id: str = None) -> Dict[str, Any]:
        """Map MobPlus offer to database format
        
        MobPlus response fields:
        - id: offer ID (int)
        - name: offer name
        - desc: description
        - status: "Live", "Paused", etc.
        - currency: "USD", "EUR"
        - categories: ["Adult", "Direct", ...]
        - trackingLink: full tracking URL with {CLICK_ID} and {SOURCE} macros
        - previewLink: image/preview URL (cloudfront)
        - ecpm24h: eCPM value
        - shortCodes: null or array
        """
        try:
            network_name = 'mobplus'
            
            # Extract offer ID
            offer_id = str(offer_data.get('id', ''))
            
            # Extract and format name
            raw_name = offer_data.get('name', '') or ''
            formatted_name = format_offer_name(raw_name)
            
            # Extract description
            raw_description = offer_data.get('desc', '') or offer_data.get('description', '') or ''
            clean_description = clean_html_description(raw_description)
            
            # Extract tracking link — MobPlus uses {CLICK_ID} and {SOURCE} macros
            # We normalize them to our standard {click_id} and {sub1}
            tracking_link = offer_data.get('trackingLink', '') or offer_data.get('tracking_link', '') or ''
            if tracking_link:
                tracking_link = tracking_link.replace('{CLICK_ID}', '{click_id}')
                tracking_link = tracking_link.replace('{SOURCE}', '{sub1}')
                tracking_link = tracking_link.replace('{SUBID}', '{sub1}')
                tracking_link = tracking_link.replace('{SUB_ID}', '{sub1}')
            
            # Extract preview/image URL
            image_url = offer_data.get('previewLink', '') or offer_data.get('preview_link', '') or ''
            preview_url = offer_data.get('previewUrl', '') or offer_data.get('preview_url', '') or image_url or ''
            
            # Extract payout
            payout = 0.0
            payout_raw = offer_data.get('payout', 0) or offer_data.get('payoutAmount', 0) or offer_data.get('defaultPayout', 0)
            try:
                payout = float(payout_raw)
            except (ValueError, TypeError):
                payout = 0.0
            
            # Extract currency
            currency = offer_data.get('currency', 'USD') or 'USD'
            
            # Extract status — MobPlus uses "Live", "Paused", etc.
            raw_status = offer_data.get('status', 'active') or 'active'
            status_map = {
                'live': 'active',
                'active': 'active',
                'paused': 'inactive',
                'stopped': 'inactive',
                'expired': 'inactive',
                'deleted': 'inactive',
            }
            status = status_map.get(str(raw_status).lower(), 'active')
            
            # Extract categories — MobPlus returns array like ["Adult", "Direct"]
            categories = offer_data.get('categories', []) or []
            if isinstance(categories, str):
                categories = [categories]
            
            # Map MobPlus categories to our vertical system
            vertical = self._map_mobplus_category_to_vertical(categories, formatted_name, clean_description)
            
            # Extract countries from offer name (MobPlus often encodes geo in name like "Offer-US-SOI")
            countries = self._extract_countries_from_text(formatted_name)
            if not countries and clean_description:
                countries = self._extract_countries_from_text(clean_description)
            if not countries:
                countries = ['WW']  # Default to Worldwide
            
            # Extract eCPM
            ecpm = offer_data.get('ecpm24h', 0) or 0
            
            # Basic mapping
            mapped = {
                'campaign_id': offer_id,
                'name': formatted_name,
                'description': clean_description,
                'preview_url': preview_url or 'https://www.google.com',
                'payout': payout,
                'currency': currency.upper() if currency else 'USD',
                'status': status,
                'network': network_name,
                'target_url': tracking_link or preview_url or '',
                'image_url': image_url,
            }
            
            # Payout type — MobPlus offers are typically CPA/CPL/CPI
            payout_type = offer_data.get('payoutType', '') or offer_data.get('payout_type', '') or 'cpa'
            mapped['offer_type'] = self.PAYOUT_TYPE_MAPPING.get(str(payout_type).lower(), 'CPA')
            mapped['payout_model'] = mapped['offer_type']
            
            # Expiration date
            expiration = offer_data.get('expirationDate', '') or offer_data.get('expiration_date', '')
            if expiration and expiration not in ['0000-00-00', '', None]:
                mapped['expiration_date'] = str(expiration)[:10]
            else:
                mapped['expiration_date'] = (datetime.utcnow() + timedelta(days=90)).strftime('%Y-%m-%d')
            
            # Vertical / Category
            mapped['vertical'] = vertical
            mapped['category'] = vertical
            
            # Countries
            mapped['countries'] = countries
            
            # Caps
            daily_cap = offer_data.get('dailyCap', 0) or offer_data.get('daily_cap', 0) or 0
            mapped['daily_cap'] = int(daily_cap)
            mapped['monthly_cap'] = int(offer_data.get('monthlyCap', 0) or offer_data.get('monthly_cap', 0) or 0)
            
            # Incentive type — extract from name or categories
            if any('incent' in c.lower() for c in categories if isinstance(c, str)):
                mapped['incentive_type'] = 'Incent'
            else:
                mapped['incentive_type'] = self._extract_incentive_type(raw_name)
            
            # Default fields
            mapped['affiliates'] = 'all'
            mapped['revenue_share_percent'] = 0
            mapped['tracking_protocol'] = ''
            mapped['conversion_flow'] = ''
            mapped['conversion_window'] = None
            mapped['conversion_type'] = ''
            mapped['traffic_type'] = ''
            mapped['device_targeting'] = self._detect_device_from_name(formatted_name if 'formatted_name' in dir() else offer_data.get('name', ''))
            mapped['allowed_traffic_sources'] = []
            mapped['blocked_traffic_sources'] = []
            mapped['restrictions'] = ''
            mapped['creative_requirements'] = ''
            mapped['terms_notes'] = ''
            mapped['affiliate_terms'] = ''
            mapped['allowed_countries'] = countries
            mapped['blocked_countries'] = []
            mapped['os_requirements'] = []
            mapped['browser_requirements'] = []
            mapped['carrier_requirements'] = []
            mapped['connection_type'] = ''
            mapped['language_requirements'] = []
            mapped['age_restrictions'] = ''
            mapped['gender_targeting'] = ''
            mapped['kpi'] = ''
            
            # Process tracking link for partner param injection
            mapped = process_offer_tracking_link(mapped, network_identifier=network_name)
            
            logger.debug(f"Mapped MobPlus offer: {mapped['name']} (campaign: {mapped['campaign_id']})")
            return mapped
            
        except Exception as e:
            logger.error(f"Error mapping MobPlus offer: {str(e)}", exc_info=True)
            return {}
    
    def _map_mobplus_category_to_vertical(self, categories: list, name: str, description: str) -> str:
        """Map MobPlus categories to our vertical system"""
        # MobPlus category to vertical mapping
        category_vertical_map = {
            'adult': 'DATING',
            'dating': 'DATING',
            'finance': 'FINANCE',
            'loan': 'LOAN',
            'insurance': 'INSURANCE',
            'health': 'HEALTH',
            'beauty': 'HEALTH',
            'nutra': 'HEALTH',
            'gaming': 'GAMES_INSTALL',
            'games': 'GAMES_INSTALL',
            'casino': 'GAMBLING',
            'gambling': 'GAMBLING',
            'betting': 'GAMBLING',
            'sweepstakes': 'SWEEPSTAKES',
            'sweeps': 'SWEEPSTAKES',
            'survey': 'SURVEY',
            'surveys': 'SURVEY',
            'education': 'EDUCATION',
            'crypto': 'CRYPTO',
            'cryptocurrency': 'CRYPTO',
            'shopping': 'SHOPPING',
            'ecommerce': 'SHOPPING',
            'travel': 'TRAVEL',
            'entertainment': 'ENTERTAINMENT',
            'streaming': 'ENTERTAINMENT',
            'install': 'INSTALLS',
            'installs': 'INSTALLS',
            'app': 'INSTALLS',
            'mobile': 'INSTALLS',
            'pin submit': 'INSTALLS',
            'pin': 'INSTALLS',
            'direct': 'INSTALLS',
            'free trial': 'FREE_TRIAL',
            'trial': 'FREE_TRIAL',
            'subscription': 'FREE_TRIAL',
        }
        
        # Try to match from categories array
        for cat in categories:
            if isinstance(cat, str):
                cat_lower = cat.lower().strip()
                if cat_lower in category_vertical_map:
                    return category_vertical_map[cat_lower]
        
        # Fallback: detect from name/description
        from models.offer import detect_vertical_from_text
        return detect_vertical_from_text(name, description)
    
    # ==================== Adscend Media Mapping ====================
    
    # AdscendMedia category_id to vertical mapping
    ADSCENDMEDIA_CATEGORY_MAP = {
        17: 'SWEEPSTAKES',       # Free
        18: 'INSTALLS',          # Mobile Apps
        19: 'ENTERTAINMENT',     # Videos
        20: 'SURVEY',            # Surveys
        21: 'SHOPPING',          # Shopping
        22: 'FREE_TRIAL',        # Free Trials
        23: 'INSTALLS',          # Downloads
        24: 'EDUCATION',         # Sign-Ups
        25: 'INSTALLS',          # Mobile Subscriptions
        26: 'SWEEPSTAKES',       # Co-Registrations
        29: 'GAMBLING',          # Casino
        30: 'GAMES_INSTALL',     # Gaming
        31: 'FINANCE',           # Finance
    }
    
    # AdscendMedia target_system to device mapping
    ADSCENDMEDIA_DEVICE_MAP = {
        0: 'all',        # Any All
        10: 'desktop',   # Windows: All
        11: 'desktop',   # Windows: IE
        12: 'desktop',   # Windows: Firefox
        13: 'desktop',   # Windows: Chrome
        18: 'desktop',   # Windows: FF or Chrome
        19: 'desktop',   # Windows: All But Chrome
        20: 'desktop',   # Mac: All
        30: 'mobile',    # Any Mobile: All
        31: 'desktop',   # Any Desktop: All
        40: 'android',   # Android: All
        50: 'ios',       # iOS: All
        51: 'ios',       # iOS: iPhone
        52: 'ios',       # iOS: iPad
        56: 'android',   # Android: 5.0 and above
    }
    
    # AdscendMedia conversion_point to flow mapping
    ADSCENDMEDIA_FLOW_MAP = {
        1: 'SOI',          # Email submit
        2: 'SOI',          # First page
        3: 'SOI',          # Second page
        4: 'CC_SUBMIT',    # Credit card submit
        5: 'PIN_SUBMIT',   # SMS/PIN confirm
        6: 'DOWNLOAD',     # Download
        7: 'CPI',          # Install
        8: 'DOI',          # Double opt-in
        9: 'SOI',          # Third page
        10: 'SOI',         # Fourth page
        11: 'SOI',         # After co-registration path
        12: 'CPC',         # Click
        13: 'CPA',         # Other
        14: 'CPI',         # Install and launch
    }
    
    def _map_adscendmedia_offer(self, offer_data: Dict, network_id: str = None) -> Dict[str, Any]:
        """
        Map Adscend Media offer data to database format.
        
        AdscendMedia API response fields:
        - offer_id, name, description, payout, click_url, preview_url
        - countries (array of 2-letter codes), category_id (array), target_system
        - conversion_point, conversion_notes, allowed_traffic, creatives, events, etc.
        """
        try:
            offer_id = str(offer_data.get('offer_id', ''))
            name = offer_data.get('name', '') or offer_data.get('adwall_name', '')
            description = offer_data.get('description', '')
            
            # Payout
            payout = float(offer_data.get('payout', 0) or 0)
            payout_custom = float(offer_data.get('payout_custom', 0) or 0)
            # Use custom payout if available and non-zero
            if payout_custom > 0:
                payout = payout_custom
            
            # Target URL (click_url is the tracking link)
            target_url = offer_data.get('click_url', '')
            preview_url = offer_data.get('preview_url', '')
            
            # Countries - already 2-letter codes from API
            countries = offer_data.get('countries', [])
            if not isinstance(countries, list):
                countries = []
            # Ensure uppercase
            countries = [c.upper() for c in countries if isinstance(c, str) and len(c) == 2]
            
            # Category → Vertical mapping
            category_ids = offer_data.get('category_id', [])
            if not isinstance(category_ids, list):
                category_ids = [category_ids] if category_ids else []
            
            vertical = 'INSTALLS'  # Default
            for cat_id in category_ids:
                try:
                    mapped = self.ADSCENDMEDIA_CATEGORY_MAP.get(int(cat_id))
                    if mapped:
                        vertical = mapped
                        break
                except (ValueError, TypeError):
                    continue
            
            # Device targeting from target_system
            target_system = offer_data.get('target_system', 0)
            try:
                target_system = int(target_system)
            except (ValueError, TypeError):
                target_system = 0
            devices = self.ADSCENDMEDIA_DEVICE_MAP.get(target_system, 'all')
            
            # Flow from conversion_point
            conversion_point = offer_data.get('conversion_point', 13)
            try:
                conversion_point = int(conversion_point)
            except (ValueError, TypeError):
                conversion_point = 13
            flow = self.ADSCENDMEDIA_FLOW_MAP.get(conversion_point, 'CPA')
            
            # Image from creatives
            image_url = ''
            creatives = offer_data.get('creatives', [])
            if isinstance(creatives, list) and creatives:
                # Pick the first active creative with a URL
                for creative in creatives:
                    if isinstance(creative, dict) and creative.get('active') == 1:
                        image_url = creative.get('url', '')
                        if image_url:
                            break
                # Fallback: first creative with URL regardless of active status
                if not image_url:
                    for creative in creatives:
                        if isinstance(creative, dict) and creative.get('url'):
                            image_url = creative.get('url', '')
                            break
            
            # Incentive type from allowed_traffic
            allowed_traffic = offer_data.get('allowed_traffic', '')
            if allowed_traffic == 'incent' or allowed_traffic in [1, 2, 3, '1', '2', '3']:
                incentive_type = 'incent'
            elif allowed_traffic == 0 or allowed_traffic == '0' or allowed_traffic == 'non-incent':
                incentive_type = 'non-incent'
            else:
                incentive_type = 'incent'  # Default for AdscendMedia (offerwall-focused)
            
            # Conversion notes / requirements
            conversion_notes = offer_data.get('conversion_notes', '')
            
            # Caps
            daily_cap = offer_data.get('daily_lead_cap')
            if daily_cap is None:
                daily_cap = 0
            else:
                try:
                    daily_cap = int(daily_cap)
                except (ValueError, TypeError):
                    daily_cap = 0
            
            # EPC and conversion rate
            epc = offer_data.get('epc_network')
            conversion_rate = offer_data.get('conversion_rate_network')
            
            # Dates
            end_date = offer_data.get('end_date') or offer_data.get('auto_end')
            added_date = offer_data.get('added', '')
            
            # Events (multi-event offers)
            events = offer_data.get('events', [])
            events_data = []
            if isinstance(events, list) and events:
                for event in events:
                    if isinstance(event, dict):
                        events_data.append({
                            'event_id': event.get('event_id'),
                            'event_name': event.get('event_name', ''),
                            'event_description': event.get('event_description', ''),
                            'event_revenue': float(event.get('event_revenue', 0) or 0),
                            'estimated_time_to_complete': event.get('estimated_time_to_complete', 0),
                            'time_to_complete': event.get('time_to_complete', 0),
                        })
            
            # Featured
            featured = offer_data.get('featured', 0) == 1
            
            # Build mapped offer
            mapped_offer = {
                'campaign_id': offer_id,
                'network_offer_id': offer_id,
                'name': format_offer_name(name) if name else f"AdscendMedia Offer {offer_id}",
                'description': clean_html_description(description) if description else '',
                'target_url': target_url,
                'preview_url': preview_url,
                'image_url': image_url,
                'payout': payout,
                'currency': 'USD',
                'countries': countries if countries else ['US'],
                'vertical': vertical,
                'category': vertical,
                'devices': devices,
                'flow': flow,
                'network': 'adscendmedia',
                'network_type': 'adscendmedia',
                'network_publisher_id': network_id or '',
                'status': 'active',
                'incentive_type': incentive_type,
                'requirements': conversion_notes,
                'daily_cap': daily_cap,
                'show_in_offerwall': True,
                'created_at': datetime.utcnow(),
                'updated_at': datetime.utcnow(),
                'source': 'api_import',
                'import_source': 'adscendmedia',
                'featured': featured,
            }
            
            # Add EPC/CR if available
            if epc is not None:
                try:
                    mapped_offer['epc'] = float(epc)
                except (ValueError, TypeError):
                    pass
            if conversion_rate is not None:
                try:
                    mapped_offer['conversion_rate'] = float(conversion_rate)
                except (ValueError, TypeError):
                    pass
            
            # Add events if multi-event offer
            if events_data:
                mapped_offer['events'] = events_data
                mapped_offer['is_multi_event'] = True
            
            # Store raw end_date for reference
            if end_date and end_date != '0000-00-00 00:00:00':
                mapped_offer['end_date'] = end_date
            
            # Store cost_to_user metadata
            cost_to_user = offer_data.get('cost_to_user', -1)
            if cost_to_user is not None and cost_to_user != -1:
                mapped_offer['cost_to_user'] = cost_to_user
            
            # Credit delay info
            credit_delay = offer_data.get('credit_delay', '0')
            if credit_delay and str(credit_delay) != '0':
                mapped_offer['credit_delay'] = str(credit_delay)
            
            return mapped_offer
            
        except Exception as e:
            logger.error(f"Error mapping AdscendMedia offer: {str(e)}", exc_info=True)
            return {}
    
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
