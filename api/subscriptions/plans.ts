const PLANS = {
  starter: { name: "Starter", price: 4900, currency: "aed", interval: "month", description: "For small businesses getting started" },
  pro:     { name: "Pro",     price: 9900, currency: "aed", interval: "month", description: "For growing teams that need more power" },
  business:{ name: "Business",price: 19900,currency: "aed", interval: "month", description: "For established companies with full needs" },
};

export default function handler(req: any, res: any) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  res.json({ plans: PLANS });
}
