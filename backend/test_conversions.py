from app import app
from models.user_reports import UserReports
from datetime import datetime

with app.app_context():
    ur = UserReports()
    start_date = datetime.strptime('2025-03-15', '%Y-%m-%d')
    end_date = datetime.strptime('2026-04-14', '%Y-%m-%d').replace(hour=23, minute=59, second=59)
    
    # Check directly
    docs = list(ur.conversions_collection.find({'timestamp': {'$gte': start_date, '$lte': end_date}}).limit(2))
    print(f"Direct fine count in date range: {ur.conversions_collection.count_documents({'timestamp': {'$gte': start_date, '$lte': end_date}})}")
    if docs:
        print(f"Sample doc: {docs[0]}")
    
    # Run the report
    report = ur.get_performance_report(
        user_id='admin',  # doesn't matter for admin
        date_range={'start': start_date, 'end': end_date},
        group_by=['date', 'offer_id'],
        pagination={'page': 1, 'per_page': 50}
    )
    
    print("Report rows count:", len(report['data']))
    sum_conv = sum(r.get('conversions', 0) for r in report['data'])
    print("Report sum conversions:", sum_conv)
