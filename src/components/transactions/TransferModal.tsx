import React, { useState } from 'react';
import { X, ArrowRightLeft } from 'lucide-react';
// SESUAIKAN BARIS DI BAWAH INI DENGAN NAMA FILE DI FOLDER src/db/ (misal: '../../db' atau '../../db/db')
import { db } from '../../db';

interface Account {
  id: string;
  name: string;
}

interface TransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  accounts: Account[];
  onSuccess?: () => void;
}

export const TransferModal: React.FC<TransferModalProps> = ({
  isOpen,
  onClose,
  accounts,
  onSuccess,
}) => {
  const [fromAccountId, setFromAccountId] = useState('');
  const [toAccountId, setToAccountId] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const numericAmount = parseFloat(amount.replace(/[^0-9]/g, ''));
    if (!fromAccountId || !toAccountId) {
      setError('Pilih rekening asal dan rekening tujuan.');
      return;
    }
    if (fromAccountId === toAccountId) {
      setError('Rekening asal dan tujuan tidak boleh sama.');
      return;
    }
    if (!numericAmount || numericAmount <= 0) {
      setError('Masukkan nominal transfer yang valid.');
      return;
    }

    const fromAccount = accounts.find((a) => a.id === fromAccountId);
    const toAccount = accounts.find((a) => a.id === toAccountId);

    try {
      // 1. Catat pengeluaran dari rekening asal
      await db.transactions.add({
        type: 'expense',
        accountId: fromAccountId,
        amount: numericAmount,
        category: 'Transfer Out',
        date,
        note: `Transfer ke ${toAccount?.name || 'Rekening lain'}${note ? ` (${note})` : ''}`,
        createdAt: new Date().toISOString(),
      });

      // 2. Catat pemasukan ke rekening tujuan
      await db.transactions.add({
        type: 'income',
        accountId: toAccountId,
        amount: numericAmount,
        category: 'Transfer In',
        date,
        note: `Transfer dari ${fromAccount?.name || 'Rekening lain'}${note ? ` (${note})` : ''}`,
        createdAt: new Date().toISOString(),
      });

      setAmount('');
      setNote('');
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      console.error('Gagal mentransfer:', err);
      setError('Terjadi kesalahan saat menyimpan transaksi transfer.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <ArrowRightLeft className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <h2 className="text-lg font-bold text-slate-800 dark:text-white">Transfer Antar Rekening</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-100 text-red-700 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Dari Rekening (Asal)
            </label>
            <select
              value={fromAccountId}
              onChange={(e) => setFromAccountId(e.target.value)}
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 p-2.5 bg-white dark:bg-slate-800 text-slate-800 dark:text-white"
              required
            >
              <option value="">-- Pilih Rekening Asal --</option>
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Ke Rekening (Tujuan)
            </label>
            <select
              value={toAccountId}
              onChange={(e) => setToAccountId(e.target.value)}
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 p-2.5 bg-white dark:bg-slate-800 text-slate-800 dark:text-white"
              required
            >
              <option value="">-- Pilih Rekening Tujuan --</option>
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Nominal (Rp)
            </label>
            <input
              type="number"
              placeholder="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 p-2.5 bg-white dark:bg-slate-800 text-slate-800 dark:text-white"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Tanggal
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 p-2.5 bg-white dark:bg-slate-800 text-slate-800 dark:text-white"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Catatan / Keterangan (Opsional)
            </label>
            <input
              type="text"
              placeholder="Contoh: Tarik tunai / Pindah saldo"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 p-2.5 bg-white dark:bg-slate-800 text-slate-800 dark:text-white"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium"
            >
              Batal
            </button>
            <button
              type="submit"
              className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-md shadow-blue-500/20"
            >
              Simpan Transfer
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
                  
