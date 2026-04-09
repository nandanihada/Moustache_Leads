import sys
sys.path.append('.')
from routes.user_payments import calculate_user_earnings
with open('debug_err.log', 'w') as f:
    orig_print = print
    def my_print(*args, **kwargs):
        f.write(' '.join(str(a) for a in args) + '\n')
    import builtins
    builtins.print = my_print
    try:
        calculate_user_earnings("67ebd239d529a6e1335b7e8d")
    finally:
        builtins.print = orig_print
