import sys
sys.path.append('.')
from routes.user_payments import calculate_user_earnings
import traceback
try:
    print(calculate_user_earnings("67ebd239d529a6e1335b7e8d"))
except Exception as e:
    traceback.print_exc()
