import React, { useState, useEffect } from "react";
import { Terminal, Monitor, Smartphone, Rocket } from "lucide-react";

/* -------------------------
   Reusable Offer Card
------------------------- */
const OfferCard = ({ icon, title, description, reward }) => (
  <div className="bg-white p-4 rounded-lg shadow hover:shadow-md transition border">
    <div className="flex items-center gap-3 mb-2">
      {icon}
      <h3 className="font-semibold">{title}</h3>
    </div>
    <p className="text-sm text-gray-600 mb-2">{description}</p>
    <span className="text-xs text-green-600 font-medium">
      Earn {reward}
    </span>
  </div>
);

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
    <h1 className="text-3xl font-bold mb-6">Welcome to Ascend Quickstart</h1>

    {/* Info Boxes */}
    <div className="space-y-4 mb-8">
      <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded">
        <p className="text-yellow-800 text-sm">
          Ensure you have an account before continuing.
        </p>
      </div>
      <div className="bg-blue-50 border-l-4 border-blue-400 p-4 rounded">
        <p className="text-blue-800 text-sm">
          Documentation covers Web, Mobile, and API integrations.
        </p>
      </div>
      <div className="bg-green-50 border-l-4 border-green-400 p-4 rounded">
        <p className="text-green-800 text-sm">
          Explore sample offers and try the live demo.
        </p>
      </div>
    </div>

    {/* Offers Section */}
    <h2 className="text-xl font-semibold mb-4">Featured Offers</h2>
    <div className="grid md:grid-cols-2 gap-4 mb-12">
      <OfferCard
        icon={<Terminal className="h-5 w-5 text-purple-500" />}
        title="Survey Completion"
        description="Complete surveys to earn rewards instantly."
        reward="50 Coins"
      />
      <OfferCard
        icon={<Rocket className="h-5 w-5 text-pink-500" />}
        title="App Install"
        description="Download and install apps to get rewards."
        reward="100 Coins"
      />
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
   Web Offerwall Content
------------------------- */
const WebOfferwallContent = () => (
  <div className="max-w-4xl mx-auto px-4 py-8">
    <h1 className="text-3xl font-bold mb-6">Web Offerwall Integration</h1>

    {/* Step 1 */}
    <h2 className="text-xl font-semibold mb-2">1. Embed the Offerwall</h2>
    <p className="text-gray-600 mb-4">
      Place this iframe where you want the Offerwall to appear:
    </p>
    <CodeBlock
      language="html"
      code={`<iframe src="https://ascend.example.com/offerwall?userId=USER_ID"
  width="100%" height="600" frameborder="0"></iframe>`}
    />

    {/* Step 2 */}
    <h2 className="text-xl font-semibold mt-8 mb-2">2. Pass User ID</h2>
    <p className="text-gray-600 mb-4">
      Replace <code>USER_ID</code> with the ID of your user.
    </p>

    {/* Step 3 */}
    <h2 className="text-xl font-semibold mt-8 mb-2">3. Reward Callback</h2>
    <CodeBlock
      language="js"
      code={`app.post('/ascend/callback', (req, res) => {
  const { userId, reward } = req.body;
  creditUser(userId, reward);
  res.sendStatus(200);
});`}
    />

    {/* Live Placeholder */}
    <div className="mt-12 bg-gray-50 border rounded-lg p-6 text-center">
      <Monitor className="h-10 w-10 mx-auto text-blue-500 mb-2" />
      <p className="text-gray-500 text-sm">Live Offerwall Preview Coming Soon</p>
    </div>

    {/* Navigation */}
    <div className="flex justify-between text-sm mt-8">
      <span className="text-blue-600 cursor-pointer hover:underline">
        ← Previous: Quickstart
      </span>
      <span className="text-gray-400">Next: Mobile SDK →</span>
    </div>
  </div>
);

/* -------------------------
   Main Page Layout
------------------------- */
const AscendContent = () => {
  const [activePage, setActivePage] = useState("quickstart");
  const [cookieConsent, setCookieConsent] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // load saved consent
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
        <div className="p-4 font-bold border-b">Ascend Docs</div>
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
        {/* Header */}
        <header className="bg-white border-b p-4 flex justify-between items-center">
          <button
            className="md:hidden p-2 border rounded"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            ☰
          </button>
          <h1 className="font-semibold text-gray-800">Ascend Developer Docs</h1>
        </header>

        <main className="flex-1">
          {activePage === "quickstart" && <QuickstartContent />}
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
