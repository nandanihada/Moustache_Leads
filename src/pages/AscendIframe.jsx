import React, { useState, useEffect } from "react";
import { Monitor, Info } from "lucide-react";

/* -------------------------
   Code Block Component
------------------------- */
const CodeBlock = ({ code, language }) => (
  <pre className="bg-gray-900 text-white p-4 rounded-lg overflow-x-auto text-sm">
    <code className={`language-${language}`}>{code}</code>
  </pre>
);

/* -------------------------
   Quickstart Content
------------------------- */
const QuickstartContent = () => (
  <div className="max-w-4xl mx-auto px-4 py-8">
    <h1 className="text-3xl font-bold mb-6">Quickstart</h1>
    <p className="text-gray-600 mb-4">
      This guide will walk you through the steps you need to take to start 
      monetizing with MoustacheLeads. Start by learning how to integrate the 
      MoustacheLeads Offerwall & API.
    </p>

    {/* Quick Info */}
    <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded mb-8">
      <p className="text-yellow-800 text-sm flex items-center gap-2">
        <Info className="h-4 w-4 text-yellow-500" />
        <strong>Quick Info:</strong> Maximize your revenue with MoustacheLeads, 
        the leader in rewarded advertising. Monetize your website or app’s user base 
        effortlessly with non-intrusive ads. Partner with us to unlock your earning 
        potential. Start earning more now!
      </p>
    </div>

    {/* How does it work */}
    <h2 className="text-xl font-semibold mb-3">How does it work?</h2>
    <p className="text-gray-600 mb-6">
      Empower your users to earn additional virtual currency within your app 
      or website. Present them with a curated list of offers to effortlessly 
      accumulate more virtual currency.
    </p>

    {/* Offer Examples - compact row style */}
    <div className="bg-white shadow rounded-lg p-6 mb-8">
      <h3 className="font-semibold text-gray-700 mb-4">
        MoustacheLeads Offer Examples
      </h3>

      <div className="divide-y">
        {/* Offer 1 */}
        <div className="flex items-center justify-between py-3">
          <div className="flex items-center gap-3">
            <img
              src="data:image/jpeg;base64,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"
              alt="Lords Mobile"
              className="w-12 h-12 rounded object-cover"
            />
            <div>
              <h4 className="font-medium text-gray-800">Lords Mobile</h4>
              <p className="text-xs text-gray-500">
                Discover and conquer in this epic strategy game.
              </p>
            </div>
          </div>
          <span className="bg-blue-100 text-blue-700 text-xs px-2 py-1 rounded-full">
            Earn up to 9912
          </span>
        </div>

        {/* Offer 2 */}
        <div className="flex items-center justify-between py-3">
          <div className="flex items-center gap-3">
            <img
              src="data:image/jpeg;base64,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"
              alt="Raid Shadow Legends"
              className="w-12 h-12 rounded object-cover"
            />
            <div>
              <h4 className="font-medium text-gray-800">Raid Shadow Legends</h4>
              <p className="text-xs text-gray-500">
                Prepare for a battle in a world of legends.
              </p>
            </div>
          </div>
          <span className="bg-blue-100 text-blue-700 text-xs px-2 py-1 rounded-full">
            Earn up to 8726
          </span>
        </div>

        {/* Offer 3 */}
        <div className="flex items-center justify-between py-3">
          <div className="flex items-center gap-3">
            <img
              src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQn9fq94rr2V9btNkoweBMcMDoVVIxGQjMhkg&s"
              alt="DoorDash"
              className="w-12 h-12 rounded object-cover"
            />
            <div>
              <h4 className="font-medium text-gray-800">DoorDash</h4>
              <p className="text-xs text-gray-500">
                Be your own boss, choose when and where you deliver.
              </p>
            </div>
          </div>
          <span className="bg-blue-100 text-blue-700 text-xs px-2 py-1 rounded-full">
            Earn up to 6312
          </span>
        </div>

        {/* Offer 4 */}
        <div className="flex items-center justify-between py-3">
          <div className="flex items-center gap-3">
            <img
              src="https://play-lh.googleusercontent.com/8NhWnyQoHHLGtkSFKw-Dj9_LNXmuQu1yNZR7-y2JSK9amKM6kPpmGLjiqqiw4RGKlYkv=w526-h296-rw"
              alt="Game of Khans"
              className="w-12 h-12 rounded object-cover"
            />
            <div>
              <h4 className="font-medium text-gray-800">Game of Khans</h4>
              <p className="text-xs text-gray-500">
                Experience war and romance in an immersive world.
              </p>
            </div>
          </div>
          <span className="bg-blue-100 text-blue-700 text-xs px-2 py-1 rounded-full">
            Earn up to 6004
          </span>
        </div>
      </div>
    </div>

    {/* Ready to Start */}
    <h2 className="text-xl font-semibold mb-3">I am ready to start</h2>
    <p className="text-gray-600 mb-4">
      Cool, let's start by creating an account on MoustacheLeads,{" "}
      <a
        href=""
        target="_blank"
        rel="noreferrer"
        className="text-blue-600 underline"
      >
        click here
      </a>
    </p>

    <div className="bg-green-50 border-l-4 border-green-400 p-4 rounded mb-12">
      <p className="text-green-800 text-sm">
        <strong>Good to know:</strong> Leverage the power of our Featured Offer 
        section by integrating our static API, resulting in increased revenue 
        and heightened attention. Our partners experience up to 300% growth 
        from users who implement featured offers.
      </p>
    </div>

    {/* Navigation */}
    <div className="flex justify-between text-sm">
      <span className="text-gray-400">← Previous: Introduction</span>
      <span className="text-blue-600 cursor-pointer hover:underline">
        Next: Integration →
      </span>
    </div>
  </div>
);

/* -------------------------
   Offerwall Integration Content
------------------------- */
const OfferwallIntegrationContent = () => {
  const [placementId, setPlacementId] = React.useState("YOUR_PLACEMENT_ID");
  const [userId, setUserId] = React.useState("user123");
  const [iframeUrl, setIframeUrl] = React.useState("");

  React.useEffect(() => {
    const baseUrl = window.location.origin;
    setIframeUrl(`${baseUrl}/offerwall?placement_id=${placementId}&user_id=${userId}`);
  }, [placementId, userId]);

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-2">🎯 Offerwall Integration</h1>
      <p className="text-gray-600 mb-8">
        Embed our offerwall iframe on your website or app to monetize your user base with rewarded offers.
      </p>

      {/* Step 1: Get Your Placement ID */}
      <div className="bg-white rounded-lg shadow p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4">Step 1: Get Your Placement ID</h2>
        <p className="text-gray-600 mb-4">
          Each placement gets a unique ID. Go to your <strong>Placements</strong> page to find your placement ID.
        </p>
        <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
          <p className="text-blue-900 font-mono text-sm">
            Example: <code>placement_abc123xyz789</code>
          </p>
        </div>
      </div>

      {/* Step 2: Embed the Iframe */}
      <div className="bg-white rounded-lg shadow p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4">Step 2: Embed the Iframe</h2>
        <p className="text-gray-600 mb-4">
          Copy this code and paste it where you want the offerwall to appear:
        </p>
        <CodeBlock
          language="html"
          code={`<iframe 
  src="https://yourdomain.com/offerwall?placement_id=YOUR_PLACEMENT_ID&user_id=USER_ID"
  width="100%" 
  height="600" 
  frameborder="0"
  style="border: none; border-radius: 8px;">
</iframe>`}
        />
        <p className="text-gray-600 mt-4 text-sm">
          Replace <code>YOUR_PLACEMENT_ID</code> with your actual placement ID and <code>USER_ID</code> with the end user's unique ID.
        </p>
      </div>

      {/* Step 3: Test Your Integration */}
      <div className="bg-white rounded-lg shadow p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4">Step 3: Test Your Integration</h2>
        <p className="text-gray-600 mb-4">
          Configure test parameters below and preview the iframe:
        </p>
        
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Placement ID</label>
            <input
              type="text"
              value={placementId}
              onChange={(e) => setPlacementId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="placement_abc123"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">User ID</label>
            <input
              type="text"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="user123"
            />
          </div>
        </div>

        <div className="bg-gray-100 p-4 rounded-lg mb-4">
          <p className="text-sm text-gray-600 mb-2">Generated URL:</p>
          <code className="text-xs text-gray-800 break-all">{iframeUrl}</code>
        </div>

        <div className="bg-yellow-50 border-l-4 border-yellow-500 p-4 rounded">
          <p className="text-yellow-900 text-sm">
            <strong>Note:</strong> The iframe preview will load once you have a valid placement ID configured in your system.
          </p>
        </div>
      </div>

      {/* What Gets Tracked */}
      <div className="bg-white rounded-lg shadow p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4">📊 What Gets Tracked</h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="border-l-4 border-green-500 pl-4">
            <h3 className="font-semibold text-gray-800 mb-2">User Tracking</h3>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>✓ User ID</li>
              <li>✓ Session ID</li>
              <li>✓ Device Type</li>
              <li>✓ Country/Geo</li>
            </ul>
          </div>
          <div className="border-l-4 border-blue-500 pl-4">
            <h3 className="font-semibold text-gray-800 mb-2">Engagement Metrics</h3>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>✓ Impressions</li>
              <li>✓ Clicks</li>
              <li>✓ Time Spent</li>
              <li>✓ Conversions</li>
            </ul>
          </div>
          <div className="border-l-4 border-purple-500 pl-4">
            <h3 className="font-semibold text-gray-800 mb-2">Fraud Detection</h3>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>✓ Duplicate Clicks</li>
              <li>✓ VPN Detection</li>
              <li>✓ Bot Detection</li>
              <li>✓ Fraud Scoring</li>
            </ul>
          </div>
          <div className="border-l-4 border-orange-500 pl-4">
            <h3 className="font-semibold text-gray-800 mb-2">Analytics</h3>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>✓ CTR (Click-Through Rate)</li>
              <li>✓ Conversion Rate</li>
              <li>✓ EPC (Earnings Per Click)</li>
              <li>✓ Country Breakdown</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Advanced Options */}
      <div className="bg-white rounded-lg shadow p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4">Advanced Options</h2>
        
        <h3 className="font-semibold text-gray-800 mb-3">Optional Parameters</h3>
        <CodeBlock
          language="html"
          code={`<!-- Add these optional parameters to track external campaigns -->
<iframe 
  src="https://yourdomain.com/offerwall?placement_id=YOUR_PLACEMENT_ID&user_id=USER_ID&sub_id=CAMPAIGN_ID&country=US"
  width="100%" 
  height="600" 
  frameborder="0">
</iframe>`}
        />

        <div className="mt-4 space-y-2 text-sm text-gray-600">
          <p><strong>sub_id:</strong> Your external campaign tracking ID</p>
          <p><strong>country:</strong> Force specific country (2-letter code)</p>
          <p><strong>category:</strong> Filter offers by category</p>
        </div>
      </div>

      {/* Support */}
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-6 mb-8">
        <h2 className="text-xl font-semibold mb-2">Need Help?</h2>
        <p className="text-gray-700 mb-4">
          Check our analytics dashboard to monitor your offerwall performance in real-time.
        </p>
        <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition">
          View Analytics Dashboard
        </button>
      </div>
    </div>
  );
};

/* -------------------------
   Web Offerwall Content (unchanged)
------------------------- */
const WebOfferwallContent = () => (
  <div className="max-w-4xl mx-auto px-4 py-8">
    <h1 className="text-3xl font-bold mb-6">MoustacheLeads Web Offerwall</h1>
    <h2 className="text-xl font-semibold mb-2">1. Embed the Offerwall</h2>
    <p className="text-gray-600 mb-4">
      Place this iframe where you want the MoustacheLeads Offerwall to appear:
    </p>
    <CodeBlock
      language="html"
      code={`<iframe src="https://moustacheleads.example.com/offerwall?userId=USER_ID"
  width="100%" height="600" frameborder="0"></iframe>`}
    />
    <h2 className="text-xl font-semibold mt-8 mb-2">2. Pass User ID</h2>
    <p className="text-gray-600 mb-4">
      Replace <code>USER_ID</code> with the unique identifier of your user.
    </p>
    <h2 className="text-xl font-semibold mt-8 mb-2">3. Reward Callback</h2>
    <CodeBlock
      language="js"
      code={`app.post('/moustacheleads/callback', (req, res) => {
  const { userId, reward } = req.body;
  creditUser(userId, reward);
  res.sendStatus(200);
});`}
    />
    <div className="mt-12 bg-gray-50 border rounded-lg p-6 text-center">
      <Monitor className="h-10 w-10 mx-auto text-blue-500 mb-2" />
      <p className="text-gray-500 text-sm">Live Offerwall Preview Coming Soon</p>
    </div>
    <div className="flex justify-between text-sm mt-8">
      <span className="text-blue-600 cursor-pointer hover:underline">
        ← Previous: Quickstart
      </span>
      <span className="text-gray-400">Next: Mobile SDK →</span>
    </div>
  </div>
);

/* -------------------------
   Main Layout
------------------------- */
const AscendContent = () => {
  const [activePage, setActivePage] = useState("quickstart");
  const [cookieConsent, setCookieConsent] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem("cookieConsent");
    if (saved) setCookieConsent(true);
  }, []);

  const handleConsent = () => {
    localStorage.setItem("cookieConsent", "true");
    setCookieConsent(true);
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Sidebar */}
      <div
        className={`${
          sidebarOpen ? "w-64" : "w-0"
        } bg-white border-r transition-all overflow-hidden`}
      >
        <div className="p-4 font-bold border-b">MoustacheLeads Docs</div>
        <nav className="p-4 space-y-2 text-sm">
          <button
            onClick={() => setActivePage("quickstart")}
            className={`block w-full text-left px-3 py-2 rounded ${
              activePage === "quickstart"
                ? "bg-blue-100 text-blue-600 font-medium"
                : "hover:bg-gray-100"
            }`}
          >
            Quickstart
          </button>
          <button
            onClick={() => setActivePage("offerwall-integration")}
            className={`block w-full text-left px-3 py-2 rounded ${
              activePage === "offerwall-integration"
                ? "bg-blue-100 text-blue-600 font-medium"
                : "hover:bg-gray-100"
            }`}
          >
            🎯 Offerwall Integration
          </button>
          <button
            onClick={() => setActivePage("offerwall")}
            className={`block w-full text-left px-3 py-2 rounded ${
              activePage === "offerwall"
                ? "bg-blue-100 text-blue-600 font-medium"
                : "hover:bg-gray-100"
            }`}
          >
            Web Offerwall
          </button>
        </nav>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        <header className="bg-white border-b p-4 flex justify-between items-center">
          <button
            className="md:hidden p-2 border rounded"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            ☰
          </button>
          <h1 className="font-semibold text-gray-800">MoustacheLeads Developer Docs</h1>
        </header>
        <main className="flex-1">
          {activePage === "quickstart" && <QuickstartContent />}
          {activePage === "offerwall-integration" && <OfferwallIntegrationContent />}
          {activePage === "offerwall" && <WebOfferwallContent />}
        </main>
      </div>

      {/* Cookie Banner */}
      {!cookieConsent && (
        <div className="fixed bottom-0 inset-x-0 bg-gray-800 text-white p-4 flex justify-between items-center text-sm">
          <span>
            We use cookies to improve your experience. By using this site, you
            agree to our cookie policy.
          </span>
          <button
            onClick={handleConsent}
            className="bg-blue-500 px-3 py-1 rounded text-white"
          >
            Accept
          </button>
        </div>
      )}
    </div>
  );
};

export default AscendContent;
