import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from flask import Flask, render_template_string

app = Flask(__name__)

TRACKING_REDIRECT_TEMPLATE = """{% autoescape false %}<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Redirecting...</title></head>
<body>
<script>
(function(){
  var start = Date.now();
  var cid = "{{ click_id }}";
  var beacon = "{{ beacon_url }}";
  var sent = false;
  function sendClose(){
    if(sent) return;
    sent = true;
    var elapsed = Math.round((Date.now() - start) / 1000);
    var url = beacon + "?click_id=" + encodeURIComponent(cid) + "&time_spent=" + elapsed;
    try { navigator.sendBeacon(url); } catch(e) { new Image().src = url; }
  }
  document.addEventListener("visibilitychange", function(){ if(document.hidden) sendClose(); });
  window.addEventListener("pagehide", sendClose);
  window.addEventListener("beforeunload", sendClose);
  try { navigator.sendBeacon(beacon + "?click_id=" + encodeURIComponent(cid) + "&time_spent=0"); } catch(e){}
  setTimeout(function(){ window.location.replace("{{ target_url }}"); }, 50);
})();
</script>
<noscript><meta http-equiv="refresh" content="0;url={{ target_url }}"></noscript>
</body></html>{% endautoescape %}"""

with app.app_context():
    result = render_template_string(
        TRACKING_REDIRECT_TEMPLATE,
        click_id='CLK-TEST123',
        target_url='https://offers.cpx-research.com/index.php?app_id=32512&ext_user_id=elegant&subid=CLK-TEST123',
        beacon_url='http://localhost:5000/track/beacon'
    )
    print(result)
