#include "mainwindow.h"
#include "syntaxhighlither.h"

#include <QDockWidget>
#include <QTextEdit>
#include <QLineEdit>
#include <QVBoxLayout>
#include <QWidget>
#include <QMessageBox>
#include <QMenuBar>
#include <QMenu>
#include <QFile>
#include <QTextStream>
#include <QAction>
#include <QFileDialog>


MainWindow::MainWindow(QWidget *parent)
    : QMainWindow(parent)
{

    // File menu
    QMenu *fileMenu = menuBar()->addMenu("File");

    QAction *openAction = fileMenu->addAction("Open File");


    // Main editor
    QWidget *central = new QWidget(this);
    setCentralWidget(central);


    QTextEdit *editor = new QTextEdit();

    editor->setPlaceholderText("Code editor...");


    // Attach syntax highlighting
    SyntaxHighlighter *highlighter =
        new SyntaxHighlighter(editor->document());


    QVBoxLayout *layout = new QVBoxLayout(central);

    layout->addWidget(editor);

    layout->setContentsMargins(
        20,
        20,
        20,
        20
        );



    // Open file
    connect(
        openAction,
        &QAction::triggered,
        this,
        [this, editor]()
        {
            QString filename = QFileDialog::getOpenFileName(
                this,
                "Open File",
                "",
                "All Files (*.*)"
                );


            if (!filename.isEmpty())
            {
                QFile file(filename);


                if (file.open(QIODevice::ReadOnly | QIODevice::Text))
                {
                    QTextStream stream(&file);

                    editor->setPlainText(
                        stream.readAll()
                        );

                    file.close();
                }
            }
        }
        );



    // Edit menu
    QMenu *editMenu = menuBar()->addMenu("Edit");

    QAction *editAction = editMenu->addAction("Test Message");


    connect(
        editAction,
        &QAction::triggered,
        this,
        [this]()
        {
            QMessageBox::information(
                this,
                "Edit",
                "Edit clicked"
                );
        }
        );



    // View menu
    menuBar()->addMenu("View");



    // AI Chat Dock
    QDockWidget *aiDock =
        new QDockWidget(
            "AI Chat",
            this
            );


    QWidget *chatWidget =
        new QWidget();


    QVBoxLayout *chatLayout =
        new QVBoxLayout(chatWidget);



    QTextEdit *chatHistory =
        new QTextEdit();

    chatHistory->setReadOnly(true);
    chatHistory->setPlaceholderText(
        "AI responses..."
        );



    QLineEdit *chatInput =
        new QLineEdit();

    chatInput->setPlaceholderText(
        "Ask AI..."
        );



    chatLayout->addWidget(chatHistory);
    chatLayout->addWidget(chatInput);



    aiDock->setWidget(chatWidget);


    // VS Code style dock behavior
    aiDock->setFeatures(
        QDockWidget::DockWidgetMovable |
        QDockWidget::DockWidgetFloatable
        );


    aiDock->setMinimumWidth(250);


    addDockWidget(
        Qt::RightDockWidgetArea,
        aiDock
        );



    resize(
        1200,
        700
        );
}