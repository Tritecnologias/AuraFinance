import { jsPDF } from 'jspdf';
import { Account, Category, CreditCard, Profile, SavingsGoal, Transaction } from '../types/finance';
import { formatCurrency, formatDate } from './formatters';

interface AnnualReportData {
  year: number;
  profile: Profile;
  accounts: Account[];
  creditCards: CreditCard[];
  categories: Category[];
  transactions: Transaction[];
  savingsGoals: SavingsGoal[];
}

/**
 * Generates an offscreen Canvas with a high-resolution Pie Chart for PDF inclusion
 */
function createCategoryPieChartCanvas(
  data: { name: string; value: number; color: string }[],
  width = 600,
  height = 360
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  // Background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  const total = data.reduce((acc, curr) => acc + curr.value, 0);
  if (total === 0) {
    ctx.fillStyle = '#64748b';
    ctx.font = '16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Nenhuma despesa registrada neste período', width / 2, height / 2);
    return canvas;
  }

  // Draw Pie Chart on left half
  const centerX = 160;
  const centerY = height / 2;
  const radius = 120;
  const innerRadius = 60; // Donut style
  let currentAngle = -0.5 * Math.PI;

  data.forEach((slice) => {
    const sliceAngle = (slice.value / total) * 2 * Math.PI;
    const endAngle = currentAngle + sliceAngle;

    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, currentAngle, endAngle);
    ctx.arc(centerX, centerY, innerRadius, endAngle, currentAngle, true);
    ctx.closePath();
    ctx.fillStyle = slice.color;
    ctx.fill();

    currentAngle = endAngle;
  });

  // Inner cutout text
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 18px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('100%', centerX, centerY - 8);
  ctx.font = '12px sans-serif';
  ctx.fillStyle = '#64748b';
  ctx.fillText('Total Gasto', centerX, centerY + 12);

  // Legend on right half
  const legendX = 330;
  let legendY = 30;
  const lineHeight = 28;

  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';

  data.slice(0, 9).forEach((item) => {
    const pct = ((item.value / total) * 100).toFixed(1);

    // Color marker dot
    ctx.fillStyle = item.color;
    ctx.beginPath();
    ctx.arc(legendX, legendY, 6, 0, 2 * Math.PI);
    ctx.fill();

    // Text label
    ctx.font = 'bold 12px sans-serif';
    ctx.fillStyle = '#1e293b';
    const truncatedName = item.name.length > 20 ? item.name.slice(0, 18) + '...' : item.name;
    ctx.fillText(truncatedName, legendX + 16, legendY);

    // Percentage & Value
    ctx.font = '11px monospace';
    ctx.fillStyle = '#64748b';
    ctx.fillText(`${pct}% (${formatCurrency(item.value)})`, legendX + 160, legendY);

    legendY += lineHeight;
  });

  return canvas;
}

/**
 * Main export function for generating the Consolidated Annual Financial PDF Report
 */
export async function generateAnnualFinancialReportPDF(reportData: AnnualReportData) {
  const { year, profile, accounts, creditCards, categories, transactions, savingsGoals } = reportData;

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;

  // 1. Data Aggregation for the specified year
  const yearPrefix = `${year}-`;
  const yearTransactions = transactions.filter((t) => t.date.startsWith(yearPrefix));

  const totalIncome = yearTransactions
    .filter((t) => t.type === 'income' && t.status === 'completed')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalExpense = yearTransactions
    .filter((t) => t.type === 'expense' && t.status === 'completed')
    .reduce((sum, t) => sum + t.amount, 0);

  const netSavings = totalIncome - totalExpense;
  const savingsRate = totalIncome > 0 ? (netSavings / totalIncome) * 100 : 0;
  const totalBalance = accounts.reduce((sum, a) => sum + a.current_balance, 0);

  // Group expenses by category
  const categoryMap = new Map(categories.map((c) => [c.id, c]));
  const expenseByCatMap = new Map<string, number>();

  yearTransactions
    .filter((t) => t.type === 'expense' && t.status === 'completed')
    .forEach((t) => {
      const cur = expenseByCatMap.get(t.category_id) || 0;
      expenseByCatMap.set(t.category_id, cur + t.amount);
    });

  const pieChartData = Array.from(expenseByCatMap.entries())
    .map(([catId, amount]) => {
      const cat = categoryMap.get(catId);
      return {
        name: cat?.name || 'Outros',
        value: amount,
        color: cat?.color || '#6366f1',
      };
    })
    .sort((a, b) => b.value - a.value);

  // ==========================================
  // PAGE 1: EXECUTIVE COVER & ANNUAL SUMMARY
  // ==========================================

  // Header Banner
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, pageWidth, 38, 'F');

  // Accent Line
  doc.setFillColor(99, 102, 241); // indigo-500
  doc.rect(0, 37, pageWidth, 1.5, 'F');

  // Header Brand & Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(255, 255, 255);
  doc.text('AURA FINANCE', margin, 18);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(203, 213, 225); // slate-300
  doc.text(`RELATÓRIO FINANCEIRO ANUAL CONSOLIDADO · EXERCÍCIO ${year}`, margin, 26);

  // Date and User metadata on right
  doc.setFontSize(9);
  doc.setTextColor(148, 163, 184);
  doc.text(`Titular: ${profile.full_name}`, pageWidth - margin, 18, { align: 'right' });
  doc.text(`Emissão: ${new Date().toLocaleDateString('pt-BR')}`, pageWidth - margin, 25, { align: 'right' });

  // Section 1: Executive KPI Cards
  let curY = 48;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text('1. RESUMO EXECUTIVO DO EXERCÍCIO', margin, curY);

  curY += 6;

  // 4 KPI Cards Grid
  const cardW = (contentWidth - 9) / 4;
  const cardH = 22;

  const kpis = [
    { label: 'PATRIMÔNIO CONSOLIDADO', value: formatCurrency(totalBalance), color: [99, 102, 241] },
    { label: 'RECEITAS ANUAIS', value: formatCurrency(totalIncome), color: [16, 185, 129] },
    { label: 'DESPESAS ANUAIS', value: formatCurrency(totalExpense), color: [244, 63, 94] },
    {
      label: 'BALANÇO LÍQUIDO',
      value: `${netSavings >= 0 ? '+' : ''}${formatCurrency(netSavings)}`,
      color: netSavings >= 0 ? [16, 185, 129] : [244, 63, 94],
    },
  ];

  kpis.forEach((kpi, idx) => {
    const kpiX = margin + idx * (cardW + 3);

    // Card background
    doc.setFillColor(248, 250, 252); // slate-50
    doc.setDrawColor(226, 232, 240); // slate-200
    doc.roundedRect(kpiX, curY, cardW, cardH, 2, 2, 'FD');

    // Label
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text(kpi.label, kpiX + 3.5, curY + 6);

    // Value
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(kpi.color[0], kpi.color[1], kpi.color[2]);
    doc.text(kpi.value, kpiX + 3.5, curY + 15);
  });

  curY += cardH + 10;

  // Section 2: Distribution Pie Chart
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text('2. DISTRIBUIÇÃO DAS DESPESAS POR CATEGORIA', margin, curY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text('Gráfico representativo das saídas financeiras do ano e detalhamento percentual.', margin, curY + 5);

  curY += 8;

  // Generate and insert Pie Chart Canvas image
  try {
    const pieCanvas = createCategoryPieChartCanvas(pieChartData, 800, 360);
    const pieDataUrl = pieCanvas.toDataURL('image/png');
    const chartHeight = 65;
    doc.addImage(pieDataUrl, 'PNG', margin, curY, contentWidth, chartHeight);
    curY += chartHeight + 8;
  } catch (e) {
    console.error('Error drawing chart canvas into PDF:', e);
    curY += 10;
  }

  // Section 3: Monthly Breakdown Table
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text('3. BALANÇO MENSAL DO EXERCÍCIO (FLUXO DE CAIXA)', margin, curY);

  curY += 6;

  // Table Header
  const colWidths = [35, 38, 38, 38, 33];
  doc.setFillColor(241, 245, 249); // slate-100
  doc.rect(margin, curY, contentWidth, 7, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);

  let colX = margin + 3;
  ['Mês', 'Receitas', 'Despesas', 'Resultado Líquido', 'Status'].forEach((head, i) => {
    doc.text(head, colX, curY + 4.8);
    colX += colWidths[i];
  });

  curY += 7;

  // 12 Months calculation
  const monthLabels = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);

  monthLabels.forEach((mName, mIdx) => {
    const mStr = `${year}-${String(mIdx + 1).padStart(2, '0')}`;
    const mTrans = transactions.filter((t) => t.date.startsWith(mStr) && t.status === 'completed');

    const mIncome = mTrans.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const mExpense = mTrans.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    const mNet = mIncome - mExpense;

    // Row zebra striping
    if (mIdx % 2 === 1) {
      doc.setFillColor(248, 250, 252);
      doc.rect(margin, curY, contentWidth, 5.5, 'F');
    }

    let rX = margin + 3;
    doc.setTextColor(30, 41, 59);
    doc.text(mName, rX, curY + 4);

    rX += colWidths[0];
    doc.setTextColor(16, 185, 129);
    doc.text(formatCurrency(mIncome), rX, curY + 4);

    rX += colWidths[1];
    doc.setTextColor(244, 63, 94);
    doc.text(formatCurrency(mExpense), rX, curY + 4);

    rX += colWidths[2];
    doc.setTextColor(mNet >= 0 ? 16 : 244, mNet >= 0 ? 185 : 63, mNet >= 0 ? 129 : 94);
    doc.text(`${mNet >= 0 ? '+' : ''}${formatCurrency(mNet)}`, rX, curY + 4);

    rX += colWidths[3];
    doc.setTextColor(100, 116, 139);
    doc.text(mNet > 0 ? 'Superávit' : mNet < 0 ? 'Déficit' : 'Neutro', rX, curY + 4);

    curY += 5.5;
  });

  // Footer of Page 1
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184);
  doc.text('Aura Finance · Página 1 de 2 · Gerado eletronicamente com integridade garantida', margin, pageHeight - 8);

  // ==========================================
  // PAGE 2: ASSETS, GOALS & FINAL BALANCE
  // ==========================================
  doc.addPage();

  // Header Banner Page 2
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageWidth, 24, 'F');
  doc.setFillColor(99, 102, 241);
  doc.rect(0, 23, pageWidth, 1, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(255, 255, 255);
  doc.text('AURA FINANCE · BALANÇO PATRIMONIAL & METAS', margin, 14);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(203, 213, 225);
  doc.text(`EXERCÍCIO DE ${year}`, margin, 20);

  curY = 34;

  // Section 4: Accounts and Asset Allocation
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text('4. BALANÇO DE CONTAS & ATIVOS CONSOLIDADOS', margin, curY);

  curY += 6;

  // Table Header
  const accColW = [60, 45, 45, 32];
  doc.setFillColor(241, 245, 249);
  doc.rect(margin, curY, contentWidth, 7, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);

  let accX = margin + 3;
  ['Instituição / Conta', 'Tipo', 'Saldo Atual', '% do Total'].forEach((h, i) => {
    doc.text(h, accX, curY + 4.8);
    accX += accColW[i];
  });

  curY += 7;

  accounts.forEach((acc, i) => {
    if (i % 2 === 1) {
      doc.setFillColor(248, 250, 252);
      doc.rect(margin, curY, contentWidth, 6, 'F');
    }

    const share = totalBalance > 0 ? ((acc.current_balance / totalBalance) * 100).toFixed(1) : '0';
    const typeLabel =
      acc.type === 'checking'
        ? 'Conta Corrente'
        : acc.type === 'investment'
        ? 'Investimento / Corretora'
        : acc.type === 'savings'
        ? 'Poupança / Reserva'
        : 'Dinheiro em Espécie';

    let ax = margin + 3;
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text(acc.name, ax, curY + 4.2);

    ax += accColW[0];
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text(typeLabel, ax, curY + 4.2);

    ax += accColW[1];
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text(formatCurrency(acc.current_balance), ax, curY + 4.2);

    ax += accColW[2];
    doc.setTextColor(99, 102, 241);
    doc.text(`${share}%`, ax, curY + 4.2);

    curY += 6;
  });

  curY += 10;

  // Section 5: Savings Goals Progression
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text('5. EXECUÇÃO DE METAS DE ECONOMIA (SAVINGS GOALS)', margin, curY);

  curY += 6;

  const goalColW = [60, 35, 35, 25, 27];
  doc.setFillColor(241, 245, 249);
  doc.rect(margin, curY, contentWidth, 7, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);

  let gx = margin + 3;
  ['Meta / Objetivo', 'Alvo Estipulado', 'Acumulado', 'Progresso', 'Data Alvo'].forEach((h, i) => {
    doc.text(h, gx, curY + 4.8);
    gx += goalColW[i];
  });

  curY += 7;

  savingsGoals.forEach((goal, i) => {
    if (i % 2 === 1) {
      doc.setFillColor(248, 250, 252);
      doc.rect(margin, curY, contentWidth, 6, 'F');
    }

    const gPct = goal.target_amount > 0 ? (goal.current_amount / goal.target_amount) * 100 : 0;
    const isDone = goal.current_amount >= goal.target_amount;

    let rx = margin + 3;
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text(goal.title, rx, curY + 4.2);

    rx += goalColW[0];
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text(formatCurrency(goal.target_amount), rx, curY + 4.2);

    rx += goalColW[1];
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(isDone ? 16 : 30, isDone ? 185 : 41, isDone ? 129 : 59);
    doc.text(formatCurrency(goal.current_amount), rx, curY + 4.2);

    rx += goalColW[2];
    doc.setTextColor(isDone ? 16 : 99, isDone ? 185 : 102, isDone ? 129 : 241);
    doc.text(`${gPct.toFixed(0)}% ${isDone ? '✓' : ''}`, rx, curY + 4.2);

    rx += goalColW[3];
    doc.setTextColor(100, 116, 139);
    doc.text(formatDate(goal.target_date), rx, curY + 4.2);

    curY += 6;
  });

  curY += 12;

  // Section 6: Executive Synthesis & Notes
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text('6. PARECER & DIAGNÓSTICO FINANCEIRO FINAL', margin, curY);

  curY += 6;

  // Synthesis Box
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(margin, curY, contentWidth, 36, 2, 2, 'FD');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(51, 65, 85);

  const synthesisP1 = `No exercício financeiro de ${year}, o titular ${profile.full_name} registrou um volume consolidado de receitas de ${formatCurrency(totalIncome)} contra ${formatCurrency(totalExpense)} em despesas efetivadas.`;
  const synthesisP2 = `O resultado líquido apurado resultou em ${netSavings >= 0 ? 'um superávit expressivo de ' + formatCurrency(netSavings) : 'um déficit de ' + formatCurrency(Math.abs(netSavings))}, correspondendo a uma taxa de poupança/acumulação de ${savingsRate.toFixed(1)}%.`;
  const synthesisP3 = `O patrimônio total líquido sob custódia encontra-se em ${formatCurrency(totalBalance)}, distribuído entre contas transacionais, reservas de liquidez e carteiras de investimento, com ${savingsGoals.filter((g) => g.current_amount >= g.target_amount).length} de ${savingsGoals.length} metas de economia totalmente alcançadas.`;

  doc.text(synthesisP1, margin + 4, curY + 8, { maxWidth: contentWidth - 8 });
  doc.text(synthesisP2, margin + 4, curY + 18, { maxWidth: contentWidth - 8 });
  doc.text(synthesisP3, margin + 4, curY + 28, { maxWidth: contentWidth - 8 });

  // Signature Block
  curY += 46;
  const signW = 70;
  const signX = (pageWidth - signW) / 2;

  doc.setDrawColor(148, 163, 184);
  doc.line(signX, curY, signX + signW, curY);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(30, 41, 59);
  doc.text(profile.full_name, pageWidth / 2, curY + 5, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('Titular / Gestor Financeiro Pessoal', pageWidth / 2, curY + 9, { align: 'center' });

  // Page 2 Footer
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184);
  doc.text('Aura Finance · Página 2 de 2 · Relatório Consolidado para Fins de Gestão Pessoal', margin, pageHeight - 8);

  // Trigger browser download
  const fileName = `relatorio_anual_aura_${year}_${profile.full_name.toLowerCase().replace(/\s+/g, '_')}.pdf`;
  doc.save(fileName);
}
