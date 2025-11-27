import sys
import os
from PySide6.QtWidgets import *
from PySide6.QtCore import QDate, QPropertyAnimation, QEasingCurve, QTimer
from PySide6.QtGui import QIcon
from extractor import WhatsAppExtractor
import exporter

class App(QMainWindow):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("Advanced WhatsApp Extractor")
        self.setGeometry(100, 100, 800, 600)

        self.extractor = WhatsAppExtractor()
        self.data = []

        self._init_ui()
        self._center_window()

    def _init_ui(self):
        # --- Main Widget and Layout ---
        main_widget = QWidget()
        self.setCentralWidget(main_widget)
        main_layout = QVBoxLayout(main_widget)

        # --- Login Section ---
        login_group = QGroupBox("Login")
        login_layout = QHBoxLayout()
        self.btn_login = QPushButton("Login ke WhatsApp Web")
        self.status_label = QLabel("Status: Idle")
        login_layout.addWidget(self.btn_login)
        login_layout.addWidget(self.status_label)
        login_group.setLayout(login_layout)

        # --- Scraping Mode Selection ---
        mode_group = QGroupBox("Pilih Mode Scraping")
        mode_layout = QHBoxLayout()
        self.radio_chat_history = QRadioButton("Dari Riwayat Chat")
        self.radio_group_members = QRadioButton("Dari Anggota Grup")
        self.radio_chat_history.setChecked(True)
        mode_layout.addWidget(self.radio_chat_history)
        mode_layout.addWidget(self.radio_group_members)
        mode_group.setLayout(mode_layout)

        # --- Options Widgets ---
        self.options_stack = QStackedWidget()
        self._create_chat_history_options()
        self._create_group_members_options()
        self.options_stack.addWidget(self.chat_history_widget)
        self.options_stack.addWidget(self.group_members_widget)

        # --- Scan Button ---
        self.btn_scan = QPushButton("Mulai Scan")

        # --- Results Table ---
        self.table = QTableWidget()
        self.table.setColumnCount(2)
        self.table.setHorizontalHeaderLabels(["Nomor Telepon", "Sumber/Nama"])
        self.table.horizontalHeader().setStretchLastSection(True)

        # --- Export Section ---
        export_group = QGroupBox("Pengaturan Ekspor")
        export_layout = QGridLayout()
        self.prefix_input = QLineEdit()
        self.prefix_input.setPlaceholderText("Contoh: Customer")
        self.btn_export_json = QPushButton("Ekspor JSON")
        self.btn_export_csv = QPushButton("Ekspor CSV")
        self.btn_export_vcf = QPushButton("Ekspor VCF")
        export_layout.addWidget(QLabel("Nama Kontak Kustom:"), 0, 0, 1, 2)
        export_layout.addWidget(self.prefix_input, 1, 0, 1, 2)
        export_layout.addWidget(self.btn_export_json, 2, 0)
        export_layout.addWidget(self.btn_export_csv, 2, 1)
        export_layout.addWidget(self.btn_export_vcf, 3, 0, 1, 2)
        export_group.setLayout(export_layout)

        # --- Add Widgets to Main Layout ---
        main_layout.addWidget(login_group)
        main_layout.addWidget(mode_group)
        main_layout.addWidget(self.options_stack)
        main_layout.addWidget(self.btn_scan)
        main_layout.addWidget(self.table)
        main_layout.addWidget(export_group)

        # --- Connect Signals ---
        self.btn_login.clicked.connect(self.login)
        self.btn_scan.clicked.connect(self.scan)
        self.radio_chat_history.toggled.connect(lambda: self.options_stack.setCurrentIndex(0))
        self.radio_group_members.toggled.connect(lambda: self.options_stack.setCurrentIndex(1))
        self.btn_fetch_groups.clicked.connect(self.fetch_groups)
        self.btn_export_json.clicked.connect(self.export_json)
        self.btn_export_csv.clicked.connect(self.export_csv)
        self.btn_export_vcf.clicked.connect(self.export_vcf)

    def _create_chat_history_options(self):
        self.chat_history_widget = QWidget()
        layout = QFormLayout(self.chat_history_widget)
        self.start_date_edit = QDateEdit(QDate.currentDate().addMonths(-1))
        self.end_date_edit = QDateEdit(QDate.currentDate())
        self.start_date_edit.setCalendarPopup(True)
        self.end_date_edit.setCalendarPopup(True)
        layout.addRow("Tanggal Mulai:", self.start_date_edit)
        layout.addRow("Tanggal Selesai:", self.end_date_edit)

    def _create_group_members_options(self):
        self.group_members_widget = QWidget()
        layout = QVBoxLayout(self.group_members_widget)
        self.btn_fetch_groups = QPushButton("Ambil Daftar Grup Saya")
        self.group_combo = QComboBox()
        layout.addWidget(self.btn_fetch_groups)
        layout.addWidget(self.group_combo)

    def _center_window(self):
        screen = self.screen().geometry()
        size = self.geometry()
        self.move((screen.width() - size.width()) // 2, (screen.height() - size.height()) // 2)

    def login(self):
        self.run_with_status("Membuka browser untuk login...", self.extractor.login)
        self.fade_in_widget(self.status_label)
        self.status_label.setText("Status: Browser terbuka. Silakan pindai QR code.")
        QMessageBox.information(self, "Info", "Browser telah terbuka. Silakan pindai QR code untuk login ke WhatsApp Web.")
        self.extractor.wait_logged_in()
        self.status_label.setText("Status: Berhasil Login")

    def scan(self):
        mode = 'history' if self.radio_chat_history.isChecked() else 'group'
        if mode == 'history':
            start_date = self.start_date_edit.date().toString("yyyy-MM-dd")
            end_date = self.end_date_edit.date().toString("yyyy-MM-dd")
            self.run_with_status("Memindai riwayat chat...", lambda: self.extractor.scan_all_chats(start_date=start_date, end_date=end_date))
        else: # group
            group_id = self.group_combo.currentData()
            if not group_id:
                QMessageBox.warning(self, "Peringatan", "Silakan pilih grup terlebih dahulu.")
                return
            self.run_with_status(f"Memindai anggota grup: {self.group_combo.currentText()}", lambda: self.extractor.scan_group_members(group_id))

        self.update_table(self.data)
        self.status_label.setText(f"Status: Selesai. Ditemukan {len(self.data)} kontak.")

    def fetch_groups(self):
        groups = self.run_with_status("Mengambil daftar grup...", self.extractor.get_groups)
        if groups:
            self.group_combo.clear()
            for name, group_id in groups.items():
                self.group_combo.addItem(name, group_id)
        self.status_label.setText(f"Status: Ditemukan {len(groups)} grup.")

    def run_with_status(self, message, func, *args, **kwargs):
        self.status_label.setText(f"Status: {message}")
        QApplication.processEvents()
        try:
            result = func(*args, **kwargs)
            self.data = result if isinstance(result, list) else self.data
            return result
        except Exception as e:
            QMessageBox.critical(self, "Error", str(e))
            self.status_label.setText("Status: Terjadi Error")
        return None

    def update_table(self, data):
        self.table.setRowCount(len(data))
        for i, d in enumerate(data):
            self.table.setItem(i, 0, QTableWidgetItem(d.get('phone')))
            self.table.setItem(i, 1, QTableWidgetItem(d.get('chat', '')))
        self.fade_in_widget(self.table)

    def export_data(self, export_func):
        if not self.data:
            QMessageBox.warning(self, "Peringatan", "Tidak ada data untuk diekspor. Silakan lakukan scan terlebih dahulu.")
            return
        prefix = self.prefix_input.text() or "Kontak"

        filename, _ = QFileDialog.getSaveFileName(self, "Simpan File", "", "All Files (*);;JSON Files (*.json);;CSV Files (*.csv);;VCF Files (*.vcf)")
        if filename:
            try:
                export_func(self.data, filename=filename, prefix=prefix)
                QMessageBox.information(self, "Sukses", f"Data berhasil disimpan ke {filename}")
                self.status_label.setText(f"Status: Berhasil mengekspor ke {filename}")
            except Exception as e:
                QMessageBox.critical(self, "Error", f"Gagal menyimpan file: {e}")

    def export_json(self): self.export_data(exporter.export_json)
    def export_csv(self): self.export_data(exporter.export_csv)
    def export_vcf(self): self.export_data(exporter.export_vcf)

    def fade_in_widget(self, widget):
        self.animation = QPropertyAnimation(widget, b"windowOpacity")
        self.animation.setDuration(800)
        self.animation.setStartValue(0)
        self.animation.setEndValue(1)
        self.animation.setEasingCurve(QEasingCurve.InOutQuad)
        self.animation.start()

if __name__ == '__main__':
    app = QApplication(sys.argv)
    # Apply stylesheet from styles.qss
    try:
        with open("styles.qss", "r") as f:
            app.setStyleSheet(f.read())
    except FileNotFoundError:
        print("styles.qss not found, using default style.") # Fallback

    window = App()
    window.show()
    sys.exit(app.exec())
