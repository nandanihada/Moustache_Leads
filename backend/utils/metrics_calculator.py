"""
Metrics Calculator Utility
Calculates all performance metrics for reports (CTR, CR, EPC, etc.)
"""

from typing import Dict, Any, Optional

class MetricsCalculator:
    """Calculate various performance metrics"""
    
    @staticmethod
    def calculate_ctr(clicks: int, impressions: int) -> float:
        """Calculate Click-Through Rate"""
        if impressions == 0:
            return 0.0
        return round((clicks / impressions) * 100, 2)
    
    @staticmethod
    def calculate_cr(conversions: int, clicks: int) -> float:
        """Calculate Conversion Rate"""
        if clicks == 0:
            return 0.0
        return round((conversions / clicks) * 100, 2)
    
    @staticmethod
    def calculate_unique_click_rate(unique_clicks: int, total_clicks: int) -> float:
        """Calculate Unique Click Rate"""
        if total_clicks == 0:
            return 0.0
        return round((unique_clicks / total_clicks) * 100, 2)
    
    @staticmethod
    def calculate_rejected_click_rate(rejected_clicks: int, total_clicks: int) -> float:
        """Calculate Rejected Click Rate"""
        if total_clicks == 0:
            return 0.0
        return round((rejected_clicks / total_clicks) * 100, 2)
    
    @staticmethod
    def calculate_suspicious_click_rate(suspicious_clicks: int, total_clicks: int) -> float:
        """Calculate Suspicious Click Rate"""
        if total_clicks == 0:
            return 0.0
        return round((suspicious_clicks / total_clicks) * 100, 2)
    
    @staticmethod
    def calculate_epc(payout: float, clicks: int) -> float:
        """Calculate Earnings Per Click"""
        if clicks == 0:
            return 0.0
        return round(payout / clicks, 2)
    
    @staticmethod
    def calculate_cpa(payout: float, conversions: int) -> float:
        """Calculate Cost Per Action (or Payout Per Conversion)"""
        if conversions == 0:
            return 0.0
        return round(payout / conversions, 2)
    
    @staticmethod
    def calculate_cpc(payout: float, clicks: int) -> float:
        """Calculate Cost Per Click"""
        if clicks == 0:
            return 0.0
        return round(payout / clicks, 2)
    
    @staticmethod
    def calculate_cpm(payout: float, impressions: int) -> float:
        """Calculate Cost Per Mille (per 1000 impressions)"""
        if impressions == 0:
            return 0.0
        return round((payout / impressions) * 1000, 2)
    
    @staticmethod
    def calculate_approval_rate(approved: int, total_conversions: int) -> float:
        """Calculate Conversion Approval Rate"""
        if total_conversions == 0:
            return 0.0
        return round((approved / total_conversions) * 100, 2)
    
    @staticmethod
    def calculate_roi(revenue: float, payout: float) -> float:
        """Calculate Return on Investment"""
        if payout == 0:
            return 0.0
        return round(((revenue - payout) / payout) * 100, 2)
    
    @staticmethod
    def calculate_profit(revenue: float, payout: float) -> float:
        """Calculate Profit (Revenue - Payout)"""
        return round(revenue - payout, 2)
    
    @staticmethod
    def enrich_with_metrics(data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Enrich aggregated data with calculated metrics
        
        Args:
            data: Dictionary with clicks, conversions, payout, etc.
        
        Returns:
            Data enriched with calculated metrics
        """
        clicks = data.get('clicks', 0)
        conversions = data.get('conversions', 0)
        unique_clicks = data.get('unique_clicks', 0)
        suspicious_clicks = data.get('suspicious_clicks', 0)
        rejected_clicks = data.get('rejected_clicks', 0)
        impressions = data.get('impressions', 0)
        total_payout = data.get('total_payout', 0.0)
        total_revenue = data.get('total_revenue', 0.0)
        
        # Calculate all metrics
        enriched = {
            **data,  # Keep original data
            'cr': MetricsCalculator.calculate_cr(conversions, clicks),
            'ctr': MetricsCalculator.calculate_ctr(clicks, impressions),
            'unique_click_rate': MetricsCalculator.calculate_unique_click_rate(unique_clicks, clicks),
            'suspicious_click_rate': MetricsCalculator.calculate_suspicious_click_rate(suspicious_clicks, clicks),
            'rejected_click_rate': MetricsCalculator.calculate_rejected_click_rate(rejected_clicks, clicks),
            'epc': MetricsCalculator.calculate_epc(total_payout, clicks),
            'cpa': MetricsCalculator.calculate_cpa(total_payout, conversions),
            'cpc': MetricsCalculator.calculate_cpc(total_payout, clicks),
            'cpm': MetricsCalculator.calculate_cpm(total_payout, impressions),
            'profit': MetricsCalculator.calculate_profit(total_revenue, total_payout),
            'roi': MetricsCalculator.calculate_roi(total_revenue, total_payout)
        }
        
        # Calculate approval rate if we have conversion status breakdown
        approved_conversions = data.get('approved_conversions', 0)
        if conversions > 0:
            enriched['approval_rate'] = MetricsCalculator.calculate_approval_rate(approved_conversions, conversions)
        
        return enriched
