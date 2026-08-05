#include "mainwindow.h"

#include <QApplication>
#include <QPalette>
#include <QColor>

int main(int argc, char *argv[])
{
    QApplication app(argc, argv);

    // Dark palette
    QPalette darkPalette;

    darkPalette.setColor(QPalette::Window, QColor("#121212"));
    darkPalette.setColor(QPalette::WindowText, QColor("#E0E0E0"));
    darkPalette.setColor(QPalette::Base, QColor("#1E1E1E"));
    darkPalette.setColor(QPalette::AlternateBase, QColor("#2A2A2A"));
    darkPalette.setColor(QPalette::Text, QColor("#E0E0E0"));

    darkPalette.setColor(QPalette::Button, QColor("#2A2A2A"));
    darkPalette.setColor(QPalette::ButtonText, QColor("#FFFFFF"));

    darkPalette.setColor(QPalette::Highlight, QColor("#3D5AFE"));
    darkPalette.setColor(QPalette::HighlightedText, QColor("#FFFFFF"));

    app.setPalette(darkPalette);


    // Global stylesheet
    app.setStyleSheet(R"(
        QWidget {
            background-color: #121212;
            color: #E0E0E0;
        }

        QTextEdit {
            background-color: #1E1E1E;
            color: white;
            border: 1px solid #333;
        }

        QLineEdit {
            background-color: #1E1E1E;
            color: white;
            border: 1px solid #444;
            border-radius: 8px;
            padding: 8px;
        }

        QPushButton {
            background-color: #2A2A2A;
            color: white;
            border: 1px solid #555;
            border-radius: 8px;
            padding: 8px 16px;
        }

        QPushButton:hover {
            background-color: #3A3A3A;
        }

        QPushButton:pressed {
            background-color: #1F1F1F;
        }

        QMenuBar {
            background-color: #1E1E1E;
            color: white;
        }

        QMenuBar::item:selected {
            background-color: #333333;
        }

        QMenu {
            background-color: #1E1E1E;
            color: white;
        }

        QMenu::item:selected {
            background-color: #333333;
        }

        QDockWidget {
            color: white;
        }

        QDockWidget::title {
            background-color: #1E1E1E;
            padding: 6px;
        }
    )");


    MainWindow window;
    window.show();

    return app.exec();
}