// HUCK - auction house (CPU bidders, all in-game coins)
import { S, save, addCards, removeCard } from './store.js';
import { genCard, rollStars, cardValue, rand, ri, uid } from './data.js';

const BUYER_NAMES = ['DiscDaddy', 'HuckMachine', 'LayoutLarry', 'SkyQueen', 'FlickWizard', 'StackAttack', 'ZoneBuster', 'HammerTime', 'PullKing', 'BidBoss', 'CallahanKid', 'GreatestEver', 'MarkMaster', 'BackhandBen', 'ForehandFi'];
const MARKET_ODDS = [14, 28, 28, 18, 10, 2];
const MIN = 60000;

function newListing(now) {
  const c = genCard(rollStars(MARKET_ODDS));
  const v = cardValue(c);
  return {
    id: uid(), card: c, seller: BUYER_NAMES[ri(0, BUYER_NAMES.length - 1)],
    start: Math.max(50, Math.round(v * (0.45 + rand() * 0.25) / 10) * 10), buyNow: Math.round(v * (1.25 + rand() * 0.35) / 10) * 10,
    bid: 0, bidder: null, ends: now + ri(3, 20) * MIN, nextBid: now + ri(15, 90) * 1000, cap: v * (0.85 + rand() * 0.45), myBid: 0,
  };
}
export const nextBidAmt = (l) => (l.bid ? Math.ceil(l.bid * 1.06 / 10) * 10 + 10 : l.start);

// advance everything up to `now` (works for time spent away from the app)
export function tickMarket(now = Date.now()) {
  const M = S.market, events = [];
  // CPU listings
  for (const l of M.listings) {
    while (l.nextBid < Math.min(now, l.ends)) {
      const amt = nextBidAmt(l);
      if (amt <= l.cap && amt < l.buyNow) {
        if (l.bidder === 'you') { S.coins += l.myBid; events.push({ type: 'outbid', l }); l.myBid = 0; }
        l.bid = amt; l.bidder = BUYER_NAMES[ri(0, BUYER_NAMES.length - 1)];
      }
      l.nextBid += ri(20, 150) * 1000;
    }
    if (now >= l.ends && !l.done) {
      l.done = true;
      if (l.bidder === 'you') { addCards([l.card]); events.push({ type: 'won', l }); M.log.unshift({ t: l.ends, txt: `Won ${l.card.first} ${l.card.last} for ${l.myBid}` }); }
    }
  }
  M.listings = M.listings.filter((l) => !l.done);
  while (M.listings.length < 12) M.listings.push(newListing(now));
  // your listings
  for (const m of M.mine) {
    const v = cardValue(m.card);
    if (!m.cap) m.cap = v * (0.8 + rand() * 0.5);
    while (m.nextBid < Math.min(now, m.ends) && !m.sold) {
      if (m.buyNow && m.buyNow <= m.cap * 0.97 && rand() < 0.35) { m.sold = true; m.bid = m.buyNow; m.bidder = BUYER_NAMES[ri(0, BUYER_NAMES.length - 1)]; m.soldAt = m.nextBid; break; }
      const amt = m.bid ? Math.ceil(m.bid * 1.06 / 10) * 10 + 10 : m.start;
      if (amt <= m.cap) { m.bid = amt; m.bidder = BUYER_NAMES[ri(0, BUYER_NAMES.length - 1)]; }
      m.nextBid += ri(15, 100) * 1000;
    }
    if ((m.sold || now >= m.ends) && !m.done) {
      m.done = true;
      if (m.bid) { const got = Math.round(m.bid * 0.95); S.coins += got; events.push({ type: 'sold', m, got }); M.log.unshift({ t: now, txt: `Sold ${m.card.first} ${m.card.last} to ${m.bidder} for ${got}` }); }
      else { addCards([m.card]); events.push({ type: 'unsold', m }); M.log.unshift({ t: now, txt: `${m.card.first} ${m.card.last} did not sell - back in your collection` }); }
    }
  }
  M.mine = M.mine.filter((m) => !m.done);
  M.log = M.log.slice(0, 30);
  save();
  return events;
}

export function placeBid(l) {
  const amt = nextBidAmt(l);
  if (l.bidder === 'you') return 'You are already the top bidder';
  if (S.coins < amt) return 'Not enough coins';
  S.coins -= amt; l.bid = amt; l.bidder = 'you'; l.myBid = amt;
  l.nextBid = Math.max(l.nextBid, Date.now() + ri(8, 40) * 1000);
  save(); return null;
}
export function buyNow(l) {
  if (S.coins + (l.bidder === 'you' ? l.myBid : 0) < l.buyNow) return 'Not enough coins';
  if (l.bidder === 'you') S.coins += l.myBid;
  S.coins -= l.buyNow; addCards([l.card]);
  S.market.listings = S.market.listings.filter((x) => x !== l);
  S.market.log.unshift({ t: Date.now(), txt: `Bought ${l.card.first} ${l.card.last} for ${l.buyNow}` });
  save(); return null;
}
export function listCard(card, start, buyNowPrice, mins) {
  removeCard(card.id);
  const now = Date.now();
  S.market.mine.push({ id: uid(), card, start, buyNow: buyNowPrice || 0, bid: 0, bidder: null, ends: now + mins * MIN, nextBid: now + ri(10, 45) * 1000 });
  save();
}
