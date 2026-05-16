import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/signal_provider.dart';

class TestBotScreen extends StatefulWidget {
  const TestBotScreen({super.key});

  @override
  State<TestBotScreen> createState() => _TestBotScreenState();
}

class _TestBotScreenState extends State<TestBotScreen> {
  final _formKey = GlobalKey<FormState>();
  final _leagueController = TextEditingController(text: 'เจทู/เจทรี ลีก วิสัยทัศน์ 100 ปี');
  final _matchController = TextEditingController(text: 'โทชิกิ ซิตี้ เอฟซี vs มอนเตดิโอ ยามากาตะ');
  final _lineController = TextEditingController(text: '0/0.5');
  final _amountController = TextEditingController(text: '10');
  
  String _selectedSide = 'ทีมเหย้า'; // Default
  String _selectedPeriod = 'เต็มเวลา'; // Default

  final List<String> _sides = ['ทีมเหย้า', 'ทีมเยือน', 'สูง (Over)', 'ต่ำ (Under)'];
  final List<String> _periods = ['เต็มเวลา', 'ครึ่งแรก'];

  @override
  void dispose() {
    _leagueController.dispose();
    _matchController.dispose();
    _lineController.dispose();
    _amountController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final provider = Provider.of<SignalProvider>(context, listen: false);

    return Scaffold(
      backgroundColor: const Color(0xFF0F172A),
      appBar: AppBar(
        title: const Text('Auto-Bot Manual Test'),
        backgroundColor: const Color(0xFF1E293B),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24.0),
        child: Center(
          child: Container(
            constraints: const BoxConstraints(maxWidth: 700),
            padding: const EdgeInsets.all(32),
            decoration: BoxDecoration(
              color: const Color(0xFF1E293B),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: Colors.white10),
            ),
            child: Form(
              key: _formKey,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const Text(
                    'จำลองสัญญาณ (Mock Signal)',
                    style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: Colors.yellow),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 32),
                  _buildTextField(
                    label: 'ชื่อลีก (League Name)',
                    controller: _leagueController,
                    hint: 'เช่น พรีเมียร์ลีก อังกฤษ',
                  ),
                  const SizedBox(height: 16),
                  _buildTextField(
                    label: 'คู่แข่งขัน (Match Name)',
                    controller: _matchController,
                    hint: 'ทีมเหย้า vs ทีมเยือน',
                  ),
                  const SizedBox(height: 16),
                  Row(
                    children: [
                      Expanded(
                        child: _buildDropdown(
                          label: 'เลือกฝั่ง (Side)',
                          value: _selectedSide,
                          items: _sides,
                          onChanged: (val) => setState(() => _selectedSide = val!),
                        ),
                      ),
                      const SizedBox(width: 16),
                      Expanded(
                        child: _buildDropdown(
                          label: 'ช่วงเวลา (Period)',
                          value: _selectedPeriod,
                          items: _periods,
                          onChanged: (val) => setState(() => _selectedPeriod = val!),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  Row(
                    children: [
                      Expanded(
                        child: _buildTextField(
                          label: 'ราคา (Target Line)',
                          controller: _lineController,
                          hint: 'เช่น 0, +1, -0.5/1',
                        ),
                      ),
                      const SizedBox(width: 16),
                      Expanded(
                        child: _buildTextField(
                          label: 'จำนวนเงิน (Amount)',
                          controller: _amountController,
                          keyboardType: TextInputType.number,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 40),
                  ElevatedButton(
                    onPressed: () async {
                      if (_formKey.currentState!.validate()) {
                        // ผสมค่าเพื่อให้บอทเข้าใจง่ายขึ้น
                        String finalBetSide = _selectedSide;
                        if (_selectedPeriod == 'ครึ่งแรก') {
                           finalBetSide += ' (ครึ่งแรก)';
                        }
                        
                        await provider.triggerTestBot(
                          leagueName: _leagueController.text,
                          matchName: _matchController.text,
                          betSide: finalBetSide,
                          amount: double.tryParse(_amountController.text) ?? 10.0,
                          targetLine: _lineController.text,
                        );
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(content: Text('ส่งคำสั่ง Test Bot เรียบร้อย! กรุณาเช็คหน้าจอเบราว์เซอร์')),
                        );
                      }
                    },
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.orange,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 20),
                      textStyle: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                    ),
                    child: const Text('🚀 เริ่มต้นการทดสอบ (START TEST)'),
                  ),
                  const SizedBox(height: 20),
                  Row(
                    children: [
                      Expanded(
                        child: ElevatedButton(
                          onPressed: () => provider.stopTest(),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: Colors.red,
                            foregroundColor: Colors.white,
                            padding: const EdgeInsets.symmetric(vertical: 16),
                            textStyle: const TextStyle(fontWeight: FontWeight.bold),
                          ),
                          child: const Text('🛑 STOP TEST'),
                        ),
                      ),
                      const SizedBox(width: 16),
                      Expanded(
                        child: ElevatedButton(
                          onPressed: () => provider.nextStep(),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: Colors.green,
                            foregroundColor: Colors.white,
                            padding: const EdgeInsets.symmetric(vertical: 16),
                            textStyle: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                          ),
                          child: const Text('⏩ NEXT STEP'),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildDropdown({
    required String label,
    required String value,
    required List<String> items,
    required void Function(String?) onChanged,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: const TextStyle(color: Colors.white70, fontSize: 14)),
        const SizedBox(height: 8),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          decoration: BoxDecoration(
            color: const Color(0xFF0F172A),
            borderRadius: BorderRadius.circular(8),
          ),
          child: DropdownButtonHideUnderline(
            child: DropdownButton<String>(
              value: value,
              dropdownColor: const Color(0xFF1E293B),
              style: const TextStyle(color: Colors.white),
              isExpanded: true,
              items: items.map((String item) {
                return DropdownMenuItem<String>(
                  value: item,
                  child: Text(item),
                );
              }).toList(),
              onChanged: onChanged,
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildTextField({
    required String label,
    required TextEditingController controller,
    String? hint,
    TextInputType? keyboardType,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: const TextStyle(color: Colors.white70, fontSize: 14)),
        const SizedBox(height: 8),
        TextFormField(
          controller: controller,
          keyboardType: keyboardType,
          style: const TextStyle(color: Colors.white),
          decoration: InputDecoration(
            hintText: hint,
            hintStyle: const TextStyle(color: Colors.white24),
            filled: true,
            fillColor: const Color(0xFF0F172A),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(8),
              borderSide: BorderSide.none,
            ),
            contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          ),
          validator: (value) => value == null || value.isEmpty ? 'กรุณากรอกข้อมูล' : null,
        ),
      ],
    );
  }
}
