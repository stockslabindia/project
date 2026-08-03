/**
 * Option Subscription Manager
 * 
 * Manages the ATM ± 7 sliding window for Fyers WebSocket subscriptions.
 * Keeps network bandwidth and memory usage minimal by subscribing only to the
 * 15 active strikes (ATM - 7 to ATM + 7) × 2 (CE + PE) = 30 contracts per underlying.
 */

const { fyersFeed } = require('./fyersFeed');
const { generateFyersOptionSymbol, getUpcomingExpiries } = require('./optionSeedService');
const { feedLogger } = require('../core/monitoring/logger');

class OptionSubscriptionManager {
  constructor() {
    this.activeSubscriptions = new Map(); // key (e.g. 'NIFTY:2026-08-05') -> Set of Fyers symbols
    this.lastAtmMap = new Map(); // underlying -> lastAtmStrike
    this.activeExpiries = new Map(); // underlying -> selectedExpiry
  }

  /**
   * Set active expiry view for an underlying (called when client views an option chain).
   */
  async setActiveChainView(underlying, expiryDate, currentSpotPrice) {
    const key = `${underlying}:${expiryDate}`;
    this.activeExpiries.set(underlying, expiryDate);

    const strikeGap = underlying === 'NIFTY' ? 50 : 100;
    const atm = Math.round((currentSpotPrice || (underlying === 'NIFTY' ? 24500 : 52300)) / strikeGap) * strikeGap;

    await this.updateSubscribedWindow(underlying, expiryDate, atm, strikeGap);
  }

  /**
   * Called on index price tick to recalculate ATM and slide window if index moved past strike boundary.
   */
  async onIndexTick(underlying, currentSpotPrice) {
    const expiryDate = this.activeExpiries.get(underlying);
    if (!expiryDate) return;

    const strikeGap = underlying === 'NIFTY' ? 50 : 100;
    const currentAtm = Math.round(currentSpotPrice / strikeGap) * strikeGap;
    const lastAtm = this.lastAtmMap.get(underlying);

    if (currentAtm !== lastAtm) {
      feedLogger.info(`[OPTION_SUB] Index ${underlying} moved ATM from ${lastAtm} -> ${currentAtm}. Sliding window...`);
      await this.updateSubscribedWindow(underlying, expiryDate, currentAtm, strikeGap);
    }
  }

  /**
   * Compute ATM ± 7 strikes, determine diff, and update Fyers subscriptions.
   */
  async updateSubscribedWindow(underlying, expiryDate, atmStrike, strikeGap) {
    const key = `${underlying}:${expiryDate}`;
    this.lastAtmMap.set(underlying, atmStrike);

    const expiries = getUpcomingExpiries(underlying);
    const expObj = expiries.find(e => e.date === expiryDate) || { dateObj: new Date(expiryDate) };

    const newFyersSymbols = new Set();
    const WINDOW_SIZE = 7; // ± 7 strikes

    for (let i = -WINDOW_SIZE; i <= WINDOW_SIZE; i++) {
      const strike = atmStrike + (i * strikeGap);
      if (strike <= 0) continue;

      for (const type of ['CE', 'PE']) {
        const sym = generateFyersOptionSymbol(underlying, expObj.dateObj, strike, type);
        newFyersSymbols.add(sym);
      }
    }

    const currentSubscribed = this.activeSubscriptions.get(key) || new Set();

    // Determine symbols to subscribe and unsubscribe
    const toSubscribe = [];
    const toUnsubscribe = [];

    for (const sym of newFyersSymbols) {
      if (!currentSubscribed.has(sym)) {
        toSubscribe.push(sym);
      }
    }

    for (const sym of currentSubscribed) {
      if (!newFyersSymbols.has(sym)) {
        toUnsubscribe.push(sym);
      }
    }

    // Apply changes to Fyers feed
    if (toUnsubscribe.length > 0) {
      try {
        await fyersFeed.unsubscribe(toUnsubscribe);
      } catch (e) {
        feedLogger.warn(`[OPTION_SUB] Error unsubscribing old strikes: ${e.message}`);
      }
    }

    if (toSubscribe.length > 0) {
      try {
        await fyersFeed.subscribe(toSubscribe);
      } catch (e) {
        feedLogger.warn(`[OPTION_SUB] Error subscribing new strikes: ${e.message}`);
      }
    }

    this.activeSubscriptions.set(key, newFyersSymbols);
    feedLogger.info(`[OPTION_SUB] Option chain window updated for ${key}. Subscribed: ${newFyersSymbols.size} symbols.`);
  }
}

const optionSubscriptionManager = new OptionSubscriptionManager();
module.exports = { optionSubscriptionManager };
