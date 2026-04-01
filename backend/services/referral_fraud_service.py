"""
Referral Fraud Detection Service
Runs fraud checks on new referrals before releasing bonuses.
Uses IPQualityScore API for VPN/proxy detection.
"""

import os
import logging
import requests
from database import db_instance

logger = logging.getLogger(__name__)

IPQS_API_KEY = os.getenv('IPQUALITYSCORE_API_KEY', '')


class ReferralFraudService:
    def __init__(self):
        self.referrals_p1 = db_instance.get_collection('referrals_p1')
        self.referral_fraud_log = db_instance.get_collection('referral_fraud_log')
        self.users = db_instance.get_collection('users')

    def run_fraud_checks(self, referral_doc):
        """
        Run all fraud checks on a new referral.
        Returns: (fraud_score: int, status: str, checks: list)
        
        Hard blocks (instant reject):
          - VPN / Proxy / TOR / Datacenter IP
          - Duplicate IP
          - Duplicate email
          - Duplicate device fingerprint
        
        Scoring:
          - ≤20 + no hard blocks → auto-approve
          - 21–74 → hold for manual review
          - ≥75 or any hard block → auto-reject
        """
        checks = []
        hard_block = False
        score = 0

        ip = referral_doc.get('ip_address', '')
        email = referral_doc.get('referred_email', '')
        fingerprint = referral_doc.get('device_fingerprint', '')
        referral_id = str(referral_doc.get('_id', ''))

        # 1. IPQualityScore check (VPN/Proxy/TOR/Datacenter)
        ipqs_result = self._check_ipqs(ip)
        checks.append({
            'check_name': 'ipqs_ip_check',
            'result': 'block' if ipqs_result.get('is_blocked') else 'pass',
            'details': ipqs_result
        })
        if ipqs_result.get('is_blocked'):
            hard_block = True
        score += ipqs_result.get('fraud_score_contribution', 0)

        # 2. Duplicate IP check
        dup_ip = self._check_duplicate_ip(ip, referral_id)
        checks.append({
            'check_name': 'duplicate_ip',
            'result': 'block' if dup_ip else 'pass',
            'details': {'duplicate_found': dup_ip}
        })
        if dup_ip:
            hard_block = True
            score += 30

        # 3. Duplicate email check
        dup_email = self._check_duplicate_email(email, referral_id)
        checks.append({
            'check_name': 'duplicate_email',
            'result': 'block' if dup_email else 'pass',
            'details': {'duplicate_found': dup_email}
        })
        if dup_email:
            hard_block = True
            score += 30

        # 4. Duplicate device fingerprint check
        dup_fp = self._check_duplicate_fingerprint(fingerprint, referral_id)
        checks.append({
            'check_name': 'duplicate_fingerprint',
            'result': 'block' if dup_fp else 'pass',
            'details': {'duplicate_found': dup_fp}
        })
        if dup_fp:
            hard_block = True
            score += 30

        # Cap score at 100
        score = min(score, 100)

        # Determine status
        if hard_block or score >= 75:
            status = 'rejected'
        elif score <= 20:
            status = 'approved'
        else:
            status = 'pending_review'

        # Log fraud checks
        try:
            from models.referral import Referral
            ref_model = Referral()
            ref_model.log_fraud_check(referral_id, 'p1', checks)
        except Exception as e:
            logger.error(f"Error logging fraud checks: {e}")

        return score, status, checks

    def _check_ipqs(self, ip):
        """Check IP against IPQualityScore API"""
        result = {
            'is_blocked': False,
            'is_vpn': False,
            'is_proxy': False,
            'is_tor': False,
            'is_datacenter': False,
            'fraud_score': 0,
            'fraud_score_contribution': 0
        }

        if not IPQS_API_KEY or not ip:
            logger.warning("IPQS API key not configured or no IP provided, skipping IP check")
            return result

        try:
            url = f"https://ipqualityscore.com/api/json/ip/{IPQS_API_KEY}/{ip}"
            params = {
                'strictness': 1,
                'allow_public_access_points': True,
                'lighter_penalties': False
            }
            resp = requests.get(url, params=params, timeout=10)
            data = resp.json()

            if data.get('success'):
                result['is_vpn'] = data.get('vpn', False)
                result['is_proxy'] = data.get('proxy', False)
                result['is_tor'] = data.get('tor', False)
                result['is_datacenter'] = data.get('host', '') != '' and data.get('ISP', '').lower() in [
                    'digitalocean', 'amazon', 'google', 'microsoft', 'ovh', 'hetzner', 'linode', 'vultr'
                ]
                result['fraud_score'] = data.get('fraud_score', 0)

                # Hard block if VPN/Proxy/TOR/Datacenter
                if result['is_vpn'] or result['is_proxy'] or result['is_tor'] or result['is_datacenter']:
                    result['is_blocked'] = True

                # Contribute IPQS fraud score (scaled to our 0-100)
                result['fraud_score_contribution'] = min(data.get('fraud_score', 0), 50)

        except Exception as e:
            logger.error(f"IPQS API error: {e}")

        return result

    def _check_duplicate_ip(self, ip, current_referral_id):
        """Check if this IP was already used for another referral"""
        if not ip:
            return False
        try:
            existing = self.referrals_p1.find_one({
                'ip_address': ip,
                '_id': {'$ne': current_referral_id}
            })
            return existing is not None
        except Exception:
            return False

    def _check_duplicate_email(self, email, current_referral_id):
        """Check if this email was already used for another referral"""
        if not email:
            return False
        try:
            existing = self.referrals_p1.find_one({
                'referred_email': email,
                '_id': {'$ne': current_referral_id}
            })
            return existing is not None
        except Exception:
            return False

    def _check_duplicate_fingerprint(self, fingerprint, current_referral_id):
        """Check if this device fingerprint was already used"""
        if not fingerprint:
            return False
        try:
            existing = self.referrals_p1.find_one({
                'device_fingerprint': fingerprint,
                '_id': {'$ne': current_referral_id}
            })
            return existing is not None
        except Exception:
            return False


# Singleton
referral_fraud_service = ReferralFraudService()
