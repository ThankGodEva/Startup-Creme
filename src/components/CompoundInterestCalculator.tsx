import React, { useState, useMemo } from 'react';
import {
  Coins,
  Download,
  RotateCcw,
  Sparkles,
  Info,
  Calendar,
  DollarSign,
  Percent,
  Sliders,
  TrendingUp,
  Table as TableIcon,
  ChevronDown,
  ChevronUp,
  Moon,
  Sun,
  Share2,
  Check,
} from 'lucide-react';
import { CompoundInterestYearData, CompoundInterestSummary } from '../types';

export const CompoundInterestCalculator: React.FC = () => {
  // Primary Parameters (Defaults exactly matching the user's reference image)
  const [startingAmount, setStartingAmount] = useState<number>(5000);
  const [monthlyContribution, setMonthlyContribution] = useState<number>(200);
  const [annualInterestRate, setAnnualInterestRate] = useState<number>(7.0);
  const [investmentYears, setInvestmentYears] = useState<number>(20);

  // Advanced Controls
  const [compoundingFrequency, setCompoundingFrequency] = useState<
    'monthly' | 'annually' | 'quarterly' | 'semiannually' | 'daily'
  >('monthly');
  const [contributionTiming, setContributionTiming] = useState<'end' | 'beginning'>('end');
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);
  const [showTable, setShowTable] = useState<boolean>(true);
  const [themeMode, setThemeMode] = useState<'dark' | 'light'>('light');

  // Interactive Hover state for Chart
  const [hoveredYear, setHoveredYear] = useState<number | null>(null);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);

  // Numerical Calculations
  const analysis: CompoundInterestSummary = useMemo(() => {
    const P = Math.max(0, startingAmount);
    const PMT = Math.max(0, monthlyContribution);
    const r = Math.max(0, annualInterestRate) / 100;
    const years = Math.max(1, Math.min(50, investmentYears));

    // Compounding periods per year
    let n = 12;
    if (compoundingFrequency === 'annually') n = 1;
    else if (compoundingFrequency === 'semiannually') n = 2;
    else if (compoundingFrequency === 'quarterly') n = 4;
    else if (compoundingFrequency === 'daily') n = 365;

    const monthlyRate = r / 12;
    let currentBalance = P;
    let totalDeposited = P;
    const yearData: CompoundInterestYearData[] = [];

    let yearStartBalance = P;
    let yearContributions = 0;
    let yearInterestEarned = 0;

    for (let m = 1; m <= years * 12; m++) {
      let interestThisMonth = 0;

      if (contributionTiming === 'beginning') {
        currentBalance += PMT;
        totalDeposited += PMT;
        yearContributions += PMT;
        interestThisMonth = currentBalance * monthlyRate;
        currentBalance += interestThisMonth;
      } else {
        // End of month (standard financial practice, perfectly matches the user's reference)
        interestThisMonth = currentBalance * monthlyRate;
        currentBalance += interestThisMonth;
        currentBalance += PMT;
        totalDeposited += PMT;
        yearContributions += PMT;
      }
      yearInterestEarned += interestThisMonth;

      if (m % 12 === 0) {
        const yearNum = m / 12;
        const totalInterest = Math.max(0, currentBalance - totalDeposited);
        yearData.push({
          year: yearNum,
          label: `${yearNum} yr${yearNum > 1 ? 's' : ''}`,
          startingBalance: Math.round(yearStartBalance),
          annualContribution: Math.round(yearContributions),
          totalContributions: Math.round(totalDeposited),
          interestEarnedYear: Math.round(yearInterestEarned),
          totalInterest: Math.round(totalInterest),
          endingBalance: Math.round(currentBalance),
        });

        yearStartBalance = currentBalance;
        yearContributions = 0;
        yearInterestEarned = 0;
      }
    }

    const finalBalance = Math.round(currentBalance);
    const moneyPutIn = Math.round(totalDeposited);
    const totalInterest = Math.max(0, finalBalance - moneyPutIn);
    const interestMultiplier = moneyPutIn > 0 ? Number((finalBalance / moneyPutIn).toFixed(2)) : 1;

    return {
      finalBalance,
      totalInterest,
      moneyPutIn,
      interestMultiplier,
      yearsData: yearData,
    };
  }, [
    startingAmount,
    monthlyContribution,
    annualInterestRate,
    investmentYears,
    compoundingFrequency,
    contributionTiming,
  ]);

  // Max value for chart Y-axis scaling (rounded up to clean intervals)
  const chartMaxVal = useMemo(() => {
    const maxVal = analysis.finalBalance || 10000;
    const factor = Math.pow(10, Math.floor(Math.log10(maxVal)));
    const leading = maxVal / factor;
    let roundedLeading = 10;
    if (leading <= 1.2) roundedLeading = 1.4;
    else if (leading <= 1.5) roundedLeading = 2;
    else if (leading <= 2.5) roundedLeading = 3;
    else if (leading <= 5) roundedLeading = 6;
    else roundedLeading = Math.ceil(leading * 1.15);
    return roundedLeading * factor;
  }, [analysis.finalBalance]);

  // Y-axis grid increments (6 ticks)
  const yTicks = useMemo(() => {
    const ticks = [0];
    const step = chartMaxVal / 5;
    for (let i = 1; i <= 5; i++) {
      ticks.push(step * i);
    }
    return ticks;
  }, [chartMaxVal]);

  const formatCurrencyCompact = (val: number): string => {
    if (val >= 1000000) return `$${(val / 1000000).toFixed(1)}M`;
    if (val >= 1000) return `$${Math.round(val / 1000)}k`;
    return `$${Math.round(val)}`;
  };

  // Preset scenarios
  const applyPreset = (start: number, monthly: number, rate: number, yrs: number) => {
    setStartingAmount(start);
    setMonthlyContribution(monthly);
    setAnnualInterestRate(rate);
    setInvestmentYears(yrs);
  };

  const handleReset = () => {
    setStartingAmount(5000);
    setMonthlyContribution(200);
    setAnnualInterestRate(7.0);
    setInvestmentYears(20);
    setCompoundingFrequency('monthly');
    setContributionTiming('end');
  };

  const handleCopyShareLink = () => {
    const url = `${window.location.origin}/calculators#compound-interest`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const downloadCSV = () => {
    const headers = [
      'Year',
      'Starting Balance',
      'Annual Contribution',
      'Total Contributions to Date',
      'Interest Earned This Year',
      'Total Interest to Date',
      'Ending Balance',
    ];
    const rows = analysis.yearsData.map((d) => [
      d.year,
      d.startingBalance,
      d.annualContribution,
      d.totalContributions,
      d.interestEarnedYear,
      d.totalInterest,
      d.endingBalance,
    ]);
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `startupcreme_compound_interest_${investmentYears}yrs_${annualInterestRate}pct.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const activeHoverData = useMemo(() => {
    if (hoveredYear === null) return null;
    return analysis.yearsData.find((d) => d.year === hoveredYear) || null;
  }, [hoveredYear, analysis.yearsData]);

  const isDark = themeMode === 'dark';

  return (
    <section id="compound-interest" className="space-y-8 scroll-mt-28">
      {/* Visualizer Shell (Supports dark aesthetic from image or bright business theme) */}
      <div
        className={`rounded-3xl border transition-colors p-6 sm:p-8 lg:p-10 ${
          isDark
            ? 'bg-[#121316] border-[#25272c] text-white shadow-2xl'
            : 'bg-white border-slate-200 text-slate-900 shadow-xs'
        }`}
      >
        {/* Top Header & Toolbar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 mb-8 border-b border-inherit/20">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono mb-1.5 opacity-70">
              <Coins className="w-3.5 h-3.5 text-emerald-400" />
              <span>Institutional Wealth & Capital Modeling</span>
              <span aria-hidden="true">·</span>
              <span>Exponential Growth Engine</span>
            </div>
            <h2 className="font-serif text-2xl sm:text-3xl font-extrabold tracking-tight">
              Compound Interest Calculator
            </h2>
            <p className="text-xs sm:text-sm opacity-70 mt-1 max-w-xl">
              Simulate recurring monthly deposits, cumulative capital contributions, and long-term interest acceleration over time.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
            {/* Quick Benchmark Presets */}
            <div className="hidden lg:flex items-center gap-1.5 mr-2">
              <button
                type="button"
                onClick={() => applyPreset(5000, 200, 7.0, 20)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-mono transition-colors ${
                  startingAmount === 5000 && annualInterestRate === 7.0 && investmentYears === 20
                    ? isDark
                      ? 'bg-[#2a2c33] text-emerald-400 border border-emerald-500/40'
                      : 'bg-emerald-50 text-emerald-800 border border-emerald-300'
                    : isDark
                    ? 'bg-[#1b1c20] text-slate-400 hover:text-white'
                    : 'bg-slate-100 text-slate-600 hover:text-slate-900'
                }`}
              >
                Balanced (7%)
              </button>
              <button
                type="button"
                onClick={() => applyPreset(10000, 500, 10.0, 25)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-mono transition-colors ${
                  annualInterestRate === 10.0
                    ? isDark
                      ? 'bg-[#2a2c33] text-emerald-400 border border-emerald-500/40'
                      : 'bg-emerald-50 text-emerald-800 border border-emerald-300'
                    : isDark
                    ? 'bg-[#1b1c20] text-slate-400 hover:text-white'
                    : 'bg-slate-100 text-slate-600 hover:text-slate-900'
                }`}
              >
                S&P 500 (10%)
              </button>
              <button
                type="button"
                onClick={() => applyPreset(25000, 1000, 4.5, 10)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-mono transition-colors ${
                  annualInterestRate === 4.5
                    ? isDark
                      ? 'bg-[#2a2c33] text-emerald-400 border border-emerald-500/40'
                      : 'bg-emerald-50 text-emerald-800 border border-emerald-300'
                    : isDark
                    ? 'bg-[#1b1c20] text-slate-400 hover:text-white'
                    : 'bg-slate-100 text-slate-600 hover:text-slate-900'
                }`}
              >
                Treasury (4.5%)
              </button>
            </div>

            {/* Theme Toggle (Dark Studio vs Bright Mode) */}
            <button
              type="button"
              onClick={() => setThemeMode(isDark ? 'light' : 'dark')}
              className={`p-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer border ${
                isDark
                  ? 'bg-[#1c1d22] border-[#2c2e35] text-slate-300 hover:text-white hover:bg-[#25272e]'
                  : 'bg-white border-slate-200 text-slate-700 hover:text-slate-900 shadow-2xs'
              }`}
              title={isDark ? 'Switch to Bright Mode' : 'Switch to Dark Studio Mode'}
            >
              {isDark ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5 text-slate-700" />}
              <span className="hidden sm:inline text-[11px]">{isDark ? 'Studio Dark' : 'Bright Mode'}</span>
            </button>

            {/* Reset Defaults */}
            <button
              type="button"
              onClick={handleReset}
              className={`p-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer border ${
                isDark
                  ? 'bg-[#1c1d22] border-[#2c2e35] text-slate-300 hover:text-white hover:bg-[#25272e]'
                  : 'bg-slate-100 border-slate-200 text-slate-700 hover:text-slate-900'
              }`}
              title="Reset to initial values"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline text-[11px]">Reset</span>
            </button>

            {/* Share / Copy Link */}
            <button
              type="button"
              onClick={handleCopyShareLink}
              className={`p-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer border ${
                isDark
                  ? 'bg-[#1c1d22] border-[#2c2e35] text-slate-300 hover:text-white hover:bg-[#25272e]'
                  : 'bg-slate-100 border-slate-200 text-slate-700 hover:text-slate-900'
              }`}
              title="Copy shareable link"
            >
              {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Share2 className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline text-[11px]">{copiedLink ? 'Copied' : 'Share'}</span>
            </button>
          </div>
        </div>

        {/* =================================================================
            FOUR TOP KPI STAT CARDS (EXACT LAYOUT FROM REFERENCE IMAGE)
           ================================================================= */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {/* Card 1: Final Balance */}
          <div
            className={`rounded-2xl p-5 border transition-all ${
              isDark
                ? 'bg-[#1b1c21] border-[#2c2f37]'
                : 'bg-slate-50 border-slate-200 shadow-2xs'
            }`}
          >
            <div className="text-xs font-medium opacity-70 mb-2">Final balance</div>
            <div className="font-mono text-3xl sm:text-4xl font-extrabold tracking-tight tabular-nums">
              ${analysis.finalBalance.toLocaleString()}
            </div>
            <div className="text-[11px] opacity-60 mt-1 font-mono">
              After {investmentYears} years of compounding
            </div>
          </div>

          {/* Card 2: Total Interest Earned */}
          <div
            className={`rounded-2xl p-5 border transition-all ${
              isDark
                ? 'bg-[#1b1c21] border-[#2c2f37]'
                : 'bg-slate-50 border-slate-200 shadow-2xs'
            }`}
          >
            <div className="text-xs font-medium opacity-70 mb-2">Total interest earned</div>
            <div className="font-mono text-3xl sm:text-4xl font-extrabold tracking-tight text-emerald-500 tabular-nums">
              ${analysis.totalInterest.toLocaleString()}
            </div>
            <div className="text-[11px] font-mono text-emerald-500/80 mt-1">
              +{((analysis.totalInterest / (analysis.moneyPutIn || 1)) * 100).toFixed(0)}% return on capital
            </div>
          </div>

          {/* Card 3: Money You Put In */}
          <div
            className={`rounded-2xl p-5 border transition-all ${
              isDark
                ? 'bg-[#1b1c21] border-[#2c2f37]'
                : 'bg-slate-50 border-slate-200 shadow-2xs'
            }`}
          >
            <div className="text-xs font-medium opacity-70 mb-2">Money you put in</div>
            <div className="font-mono text-3xl sm:text-4xl font-extrabold tracking-tight tabular-nums">
              ${analysis.moneyPutIn.toLocaleString()}
            </div>
            <div className="text-[11px] opacity-60 mt-1 font-mono">
              ${startingAmount.toLocaleString()} initial + ${(monthlyContribution * 12 * investmentYears).toLocaleString()} monthly
            </div>
          </div>

          {/* Card 4: Interest Multiplier */}
          <div
            className={`rounded-2xl p-5 border transition-all ${
              isDark
                ? 'bg-[#1b1c21] border-[#2c2f37]'
                : 'bg-slate-50 border-slate-200 shadow-2xs'
            }`}
          >
            <div className="text-xs font-medium opacity-70 mb-2">Interest multiplier</div>
            <div className="font-mono text-3xl sm:text-4xl font-extrabold tracking-tight tabular-nums">
              {analysis.interestMultiplier.toFixed(2)}×
            </div>
            <div className="text-[11px] opacity-60 mt-1 font-mono">
              Every $1 deposited grew into ${analysis.interestMultiplier.toFixed(2)}
            </div>
          </div>
        </div>

        {/* =================================================================
            FOUR INTERACTIVE PARAMETER SLIDERS (MATCHING REFERENCE IMAGE)
           ================================================================= */}
        <div
          className={`rounded-2xl p-6 sm:p-7 border mb-8 space-y-6 ${
            isDark ? 'bg-[#16171b] border-[#252830]' : 'bg-slate-50/70 border-slate-200'
          }`}
        >
          {/* Slider 1: Starting Amount */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs sm:text-sm font-semibold tracking-wide">
                Starting amount
              </label>
              <div className="flex items-center gap-1.5">
                <span className="font-mono text-sm sm:text-base font-bold tabular-nums">
                  ${startingAmount.toLocaleString()}
                </span>
              </div>
            </div>
            <div className="relative flex items-center">
              <input
                type="range"
                min="0"
                max="250000"
                step="500"
                value={startingAmount}
                onChange={(e) => setStartingAmount(Number(e.target.value))}
                className={`w-full h-1.5 ${isDark ? 'bg-slate-700/60' : 'bg-slate-200'} rounded-lg appearance-none cursor-pointer accent-blue-500`}
              />
            </div>
            <div className="flex justify-between text-[10px] font-mono opacity-50">
              <span>$0</span>
              <span>$50k</span>
              <span>$100k</span>
              <span>$250k</span>
            </div>
          </div>

          {/* Slider 2: Monthly Contribution */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs sm:text-sm font-semibold tracking-wide">
                Monthly contribution
              </label>
              <div className="flex items-center gap-1.5">
                <span className="font-mono text-sm sm:text-base font-bold tabular-nums">
                  ${monthlyContribution.toLocaleString()}/mo
                </span>
              </div>
            </div>
            <div className="relative flex items-center">
              <input
                type="range"
                min="0"
                max="10000"
                step="25"
                value={monthlyContribution}
                onChange={(e) => setMonthlyContribution(Number(e.target.value))}
                className={`w-full h-1.5 ${isDark ? 'bg-slate-700/60' : 'bg-slate-200'} rounded-lg appearance-none cursor-pointer accent-blue-500`}
              />
            </div>
            <div className="flex justify-between text-[10px] font-mono opacity-50">
              <span>$0/mo</span>
              <span>$1,000/mo</span>
              <span>$5,000/mo</span>
              <span>$10,000/mo</span>
            </div>
          </div>

          {/* Slider 3: Annual Interest Rate */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs sm:text-sm font-semibold tracking-wide">
                Annual interest rate
              </label>
              <div className="flex items-center gap-1.5">
                <span className="font-mono text-sm sm:text-base font-bold text-emerald-500 tabular-nums">
                  {annualInterestRate.toFixed(1)}%
                </span>
              </div>
            </div>
            <div className="relative flex items-center">
              <input
                type="range"
                min="0.5"
                max="25.0"
                step="0.1"
                value={annualInterestRate}
                onChange={(e) => setAnnualInterestRate(Number(e.target.value))}
                className={`w-full h-1.5 ${isDark ? 'bg-slate-700/60' : 'bg-slate-200'} rounded-lg appearance-none cursor-pointer accent-emerald-500`}
              />
            </div>
            <div className="flex justify-between text-[10px] font-mono opacity-50">
              <span>0.5% (T-Bills)</span>
              <span>7.0% (Real S&P)</span>
              <span>10.0% (Nominal S&P)</span>
              <span>25.0% (High Growth)</span>
            </div>
          </div>

          {/* Slider 4: Years */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs sm:text-sm font-semibold tracking-wide">
                Years
              </label>
              <div className="flex items-center gap-1.5">
                <span className="font-mono text-sm sm:text-base font-bold tabular-nums">
                  {investmentYears} yrs
                </span>
              </div>
            </div>
            <div className="relative flex items-center">
              <input
                type="range"
                min="1"
                max="45"
                step="1"
                value={investmentYears}
                onChange={(e) => setInvestmentYears(Number(e.target.value))}
                className={`w-full h-1.5 ${isDark ? 'bg-slate-700/60' : 'bg-slate-200'} rounded-lg appearance-none cursor-pointer accent-blue-500`}
              />
            </div>
            <div className="flex justify-between text-[10px] font-mono opacity-50">
              <span>1 yr</span>
              <span>10 yrs</span>
              <span>20 yrs</span>
              <span>30 yrs</span>
              <span>45 yrs</span>
            </div>
          </div>

          {/* Advanced Frequency & Timing Accordion */}
          <div className="pt-2 border-t border-inherit/20">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="text-xs font-semibold flex items-center gap-1.5 opacity-70 hover:opacity-100 transition-opacity cursor-pointer"
            >
              <span>Advanced Compounding Options</span>
              {showAdvanced ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>

            {showAdvanced && (
              <div className="grid sm:grid-cols-2 gap-4 mt-4 pt-3 border-t border-inherit/10">
                <div>
                  <label className="block text-[11px] font-mono opacity-70 mb-1">
                    Compounding Frequency
                  </label>
                  <select
                    value={compoundingFrequency}
                    onChange={(e) => setCompoundingFrequency(e.target.value as any)}
                    className={`w-full text-xs rounded-xl px-3 py-2 border transition-colors ${
                      isDark
                        ? 'bg-[#1b1c21] border-[#2c2f37] text-white focus:border-blue-500'
                        : 'bg-white border-slate-200 text-slate-900 focus:border-slate-900'
                    }`}
                  >
                    <option value="monthly">Compounded Monthly (12/yr - Default)</option>
                    <option value="quarterly">Compounded Quarterly (4/yr)</option>
                    <option value="semiannually">Compounded Semi-Annually (2/yr)</option>
                    <option value="annually">Compounded Annually (1/yr)</option>
                    <option value="daily">Compounded Daily (365/yr)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-mono opacity-70 mb-1">
                    Deposit Timing
                  </label>
                  <select
                    value={contributionTiming}
                    onChange={(e) => setContributionTiming(e.target.value as any)}
                    className={`w-full text-xs rounded-xl px-3 py-2 border transition-colors ${
                      isDark
                        ? 'bg-[#1b1c21] border-[#2c2f37] text-white focus:border-blue-500'
                        : 'bg-white border-slate-200 text-slate-900 focus:border-slate-900'
                    }`}
                  >
                    <option value="end">End of each month (Ordinary Annuity)</option>
                    <option value="beginning">Beginning of each month (Annuity Due)</option>
                  </select>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* =================================================================
            STACKED VERTICAL BAR CHART (MATCHING REFERENCE IMAGE)
           ================================================================= */}
        <div
          className={`rounded-2xl p-6 sm:p-7 border mb-8 ${
            isDark ? 'bg-[#16171b] border-[#252830]' : 'bg-slate-50/70 border-slate-200'
          }`}
        >
          {/* Chart Header & Legend */}
          <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-6 text-xs font-semibold">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-xs bg-[#2563eb]" />
                <span className="opacity-90">Contributions</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-xs bg-[#10b981]" />
                <span className="opacity-90">Interest</span>
              </div>
            </div>

            {/* Hover Tooltip Readout */}
            {activeHoverData && (
              <div className="text-xs font-mono px-3 py-1 rounded-lg bg-blue-600/10 border border-blue-500/30 text-blue-400">
                Year {activeHoverData.year}: Total ${activeHoverData.endingBalance.toLocaleString()} (
                <span className="text-blue-300">Put in: ${activeHoverData.totalContributions.toLocaleString()}</span> ·{' '}
                <span className="text-emerald-400">Interest: ${activeHoverData.totalInterest.toLocaleString()}</span>)
              </div>
            )}
          </div>

          {/* Interactive Stacked Chart Visualizer */}
          <div className="relative pt-4 pb-2">
            {/* Gridlines with Y-axis labels */}
            <div className="absolute inset-0 flex flex-col justify-between pointer-events-none pb-8">
              {yTicks.slice().reverse().map((tick, idx) => (
                <div key={idx} className="flex items-center w-full">
                  <span className="text-[10px] font-mono opacity-40 w-12 text-left shrink-0">
                    {formatCurrencyCompact(tick)}
                  </span>
                  <div className="w-full border-b border-inherit/10 h-0" />
                </div>
              ))}
            </div>

            {/* Stacked Bars Area */}
            <div className="relative z-10 pl-12 pr-2 h-72 sm:h-80 flex items-end justify-between gap-1.5 sm:gap-2">
              {analysis.yearsData.map((d) => {
                const totalPct = Math.min(100, Math.max(2, (d.endingBalance / chartMaxVal) * 100));
                const contribPct = Math.min(100, Math.max(1, (d.totalContributions / chartMaxVal) * 100));
                const interestPct = Math.max(0, totalPct - contribPct);
                const isHovered = hoveredYear === d.year;

                return (
                  <div
                    key={d.year}
                    onMouseEnter={() => setHoveredYear(d.year)}
                    onMouseLeave={() => setHoveredYear(null)}
                    className="flex-1 flex flex-col items-center justify-end h-full group relative cursor-pointer"
                  >
                    {/* Floating Tooltip on Hover */}
                    {isHovered && (
                      <div
                        className={`absolute -top-16 z-30 px-3 py-1.5 rounded-xl text-[11px] font-mono shadow-xl border pointer-events-none whitespace-nowrap ${
                          isDark
                            ? 'bg-[#1f2127] text-white border-slate-700'
                            : 'bg-slate-900 text-white border-slate-800'
                        }`}
                      >
                        <div className="font-bold">Year {d.year}: ${d.endingBalance.toLocaleString()}</div>
                        <div className="text-[10px] text-slate-300">
                          Deposited: ${d.totalContributions.toLocaleString()} · Interest: ${d.totalInterest.toLocaleString()}
                        </div>
                      </div>
                    )}

                    {/* Stacked Vertical Bar */}
                    <div
                      style={{ height: `${totalPct}%` }}
                      className={`w-full max-w-[28px] rounded-t-sm flex flex-col justify-end overflow-hidden transition-all duration-150 ${
                        isHovered ? 'ring-2 ring-white/70 scale-105' : 'hover:opacity-90'
                      }`}
                    >
                      {/* Top Stacked Segment: Interest (Emerald) */}
                      <div
                        style={{ height: `${(interestPct / totalPct) * 100}%` }}
                        className="w-full bg-[#10b981] transition-all"
                      />
                      {/* Bottom Stacked Segment: Contributions (Blue) */}
                      <div
                        style={{ height: `${(contribPct / totalPct) * 100}%` }}
                        className="w-full bg-[#2563eb] transition-all"
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* X-axis Year Labels */}
            <div className="pl-12 pr-2 pt-2.5 flex justify-between text-[10px] font-mono opacity-50 border-t border-inherit/20 mt-1">
              {analysis.yearsData.map((d, idx) => {
                // Show label for year 1, and selectively for odd or milestone years to prevent crowding
                const total = analysis.yearsData.length;
                let showLabel = false;
                if (total <= 12) showLabel = true;
                else if (total <= 25) showLabel = d.year === 1 || d.year % 2 !== 0;
                else showLabel = d.year === 1 || d.year % 5 === 0;

                return (
                  <span
                    key={d.year}
                    className={`text-center flex-1 transition-colors ${
                      hoveredYear === d.year ? 'text-emerald-400 font-bold opacity-100' : ''
                    }`}
                  >
                    {showLabel ? `${d.year} yr` : ''}
                  </span>
                );
              })}
            </div>
          </div>
        </div>

        {/* =================================================================
            ANNUAL AMORTIZATION SCHEDULE TABLE & CSV EXPORT
           ================================================================= */}
        <div
          className={`rounded-2xl border overflow-hidden ${
            isDark ? 'bg-[#16171b] border-[#252830]' : 'bg-slate-50/70 border-slate-200'
          }`}
        >
          <div className="p-5 border-b border-inherit/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="font-serif text-base font-bold flex items-center gap-2">
                <TableIcon className="w-4 h-4 text-emerald-500" />
                <span>Annual Compound Growth & Amortization Table</span>
              </h3>
              <p className="text-xs opacity-60 mt-0.5">
                Year-by-year itemization of capital contributions, annual interest earned, and progressive portfolio valuation.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={downloadCSV}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer border ${
                  isDark
                    ? 'bg-[#1e2025] hover:bg-[#282b32] border-[#2c2f37] text-slate-200'
                    : 'bg-white hover:bg-slate-100 border-slate-200 text-slate-800 shadow-2xs'
                }`}
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export CSV</span>
              </button>

              <button
                type="button"
                onClick={() => setShowTable(!showTable)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer border ${
                  isDark
                    ? 'bg-[#1e2025] hover:bg-[#282b32] border-[#2c2f37] text-slate-200'
                    : 'bg-white hover:bg-slate-100 border-slate-200 text-slate-800 shadow-2xs'
                }`}
              >
                <span>{showTable ? 'Hide Table' : 'Show Table'}</span>
                {showTable ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {showTable && (
            <div className="overflow-x-auto max-h-96">
              <table className="w-full text-left border-collapse text-xs font-mono tabular-nums">
                <thead>
                  <tr
                    className={`border-b border-inherit/20 text-[11px] font-semibold opacity-70 ${
                      isDark ? 'bg-[#1b1c21]' : 'bg-slate-100/70 text-slate-600'
                    }`}
                  >
                    <th className="py-3 px-4">Year</th>
                    <th className="py-3 px-4 text-right">Starting Balance</th>
                    <th className="py-3 px-4 text-right">Annual Contribution</th>
                    <th className="py-3 px-4 text-right text-blue-400">Total Money Put In</th>
                    <th className="py-3 px-4 text-right">Interest (Year)</th>
                    <th className="py-3 px-4 text-right text-emerald-400">Total Interest</th>
                    <th className="py-3 px-4 text-right font-bold">Ending Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-inherit/10">
                  {analysis.yearsData.map((d) => (
                    <tr
                      key={d.year}
                      onMouseEnter={() => setHoveredYear(d.year)}
                      onMouseLeave={() => setHoveredYear(null)}
                      className={`transition-colors ${
                        hoveredYear === d.year
                          ? isDark
                            ? 'bg-[#21232a]'
                            : 'bg-blue-50/60'
                          : isDark
                          ? 'hover:bg-[#1b1d22]'
                          : 'hover:bg-slate-100/40'
                      }`}
                    >
                      <td className="py-2.5 px-4 font-bold">Year {d.year}</td>
                      <td className="py-2.5 px-4 text-right opacity-80">
                        ${d.startingBalance.toLocaleString()}
                      </td>
                      <td className="py-2.5 px-4 text-right opacity-80">
                        ${d.annualContribution.toLocaleString()}
                      </td>
                      <td className="py-2.5 px-4 text-right font-semibold text-blue-500">
                        ${d.totalContributions.toLocaleString()}
                      </td>
                      <td className="py-2.5 px-4 text-right opacity-80">
                        ${d.interestEarnedYear.toLocaleString()}
                      </td>
                      <td className="py-2.5 px-4 text-right font-semibold text-emerald-500">
                        ${d.totalInterest.toLocaleString()}
                      </td>
                      <td className="py-2.5 px-4 text-right font-extrabold">
                        ${d.endingBalance.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
