import 'package:intl/intl.dart';

class Formatters {
  static final _numberFormat = NumberFormat('#,###');
  static final _decimalFormat = NumberFormat('#,###.##');
  static final _currencyFormat = NumberFormat('#,###.00');

  static String formatNumber(num value) {
    return _numberFormat.format(value);
  }

  static String formatDecimal(num value) {
    return _decimalFormat.format(value);
  }

  static String formatCurrency(num value) {
    return _currencyFormat.format(value);
  }

  static String formatBetLine(dynamic line) {
    if (line == null) return '--';
    String lineStr = line.toString();
    if (lineStr.isEmpty) return '--';
    
    // จัดการกรณีที่มีวงเล็บ เช่น [0.5] หรือ [-0.75]
    String cleanLine = lineStr.replaceAll('[', '').replaceAll(']', '').trim();
    double? val = double.tryParse(cleanLine);
    if (val == null) return lineStr;

    double absVal = val.abs();
    String formatted = "";
    
    if (absVal % 0.5 == 0.25) {
      double low = absVal - 0.25;
      double high = absVal + 0.25;
      formatted = "${_formatCompact(low)}/${_formatCompact(high)}";
    } else {
      formatted = _formatCompact(absVal);
    }

    // ใส่เครื่องหมาย + หรือ - สำหรับ HDP
    if (val > 0) formatted = "+$formatted";
    if (val < 0) formatted = "-$formatted";
    
    return formatted;
  }

  static String _formatCompact(double v) {
    if (v == v.toInt().toDouble()) return v.toInt().toString();
    return v.toString();
  }
}
