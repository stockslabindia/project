export function formatCurrency(value, currency = 'INR') {
  const num = Number(value) || 0;
  if (currency === 'INR') {
    return '₹' + num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  return '$' + num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatNumber(value, decimals = 2) {
  return Number(value).toLocaleString('en-IN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

export function formatPercent(value) {
  if (value == null || isNaN(value)) return '+0.00%';
  const sign = value >= 0 ? '+' : '';
  return sign + value.toFixed(2) + '%';
}

export function formatPrice(value, includeCurrency = false, decimals = 2) {
  if (value == null || isNaN(value)) return '0.00';
  const num = Number(value);
  const decimalCount = (num > 0 && num < 0.05) ? 4 : decimals;
  const formatted = num.toLocaleString('en-IN', { 
    minimumFractionDigits: decimalCount, 
    maximumFractionDigits: decimalCount 
  });
  
  if (includeCurrency) {
    return '₹' + formatted;
  }
  return formatted;
}

export function cn(...classes) {
  return classes.filter(Boolean).join(' ');
}

export function getMarketStatus(segment) {
  if (!segment) return { open: true, statusText: 'OPEN', color: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' };

  const now = new Date();
  
  const utcDay = now.getUTCDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
  const utcHours = now.getUTCHours();
  const utcMinutes = now.getUTCMinutes();
  
  // IST is UTC + 5:30
  let istMinutes = utcMinutes + 30;
  let istHours = utcHours + 5;
  if (istMinutes >= 60) {
    istMinutes -= 60;
    istHours += 1;
  }
  let istDay = utcDay;
  if (istHours >= 24) {
    istHours -= 24;
    istDay = (istDay + 1) % 7;
  }
  
  const istTimeNum = istHours * 100 + istMinutes;

  // Crypto: 24/7
  if (segment === 'crypto') {
    return { open: true, statusText: 'LIVE', color: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' };
  }

  // Forex: Sunday 22:00 UTC to Friday 22:00 UTC
  if (segment === 'forex') {
    let open = true;
    if (utcDay === 6) { // Saturday
      open = false;
    } else if (utcDay === 0) { // Sunday after 22:00 UTC
      open = utcHours >= 22;
    } else if (utcDay === 5) { // Friday before 22:00 UTC
      open = utcHours < 22;
    }
    return { 
      open, 
      statusText: open ? 'LIVE' : 'CLOSED', 
      color: open 
        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
        : 'bg-red-500/10 text-red-400 border border-red-500/20' 
    };
  }

  // US Equities: Weekdays 09:30 to 16:00 EST/EDT
  if (segment === 'us_equity') {
    const isWeekday = utcDay >= 1 && utcDay <= 5;
    let open = false;
    if (isWeekday) {
      const estDate = new Date(now.toLocaleString("en-US", {timeZone: "America/New_York"}));
      const estDay = estDate.getDay();
      const estHours = estDate.getHours();
      const estMinutes = estDate.getMinutes();
      const estTimeNum = estHours * 100 + estMinutes;
      
      const isEstWeekday = estDay >= 1 && estDay <= 5;
      open = isEstWeekday && estTimeNum >= 930 && estTimeNum < 1600;
    }
    return {
      open,
      statusText: open ? 'LIVE' : 'CLOSED',
      color: open 
        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
        : 'bg-red-500/10 text-red-400 border border-red-500/20'
    };
  }

  // MCX: Weekdays 09:00 to 23:30 IST
  if (segment === 'mcx') {
    const isWeekday = istDay >= 1 && istDay <= 5;
    const open = isWeekday && istTimeNum >= 900 && istTimeNum < 2330;
    return {
      open,
      statusText: open ? 'LIVE' : 'CLOSED',
      color: open 
        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
        : 'bg-red-500/10 text-red-400 border border-red-500/20'
    };
  }

  // Indian Equities/F&O (nse_equity, bse_equity, fo_futures, fo_options): Weekdays 09:15 to 15:30 IST
  const isIstWeekday = istDay >= 1 && istDay <= 5;
  const open = isIstWeekday && istTimeNum >= 915 && istTimeNum < 1530;
  return {
    open,
    statusText: open ? 'LIVE' : 'CLOSED',
    color: open 
      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
      : 'bg-red-500/10 text-red-400 border border-red-500/20'
  };
}
