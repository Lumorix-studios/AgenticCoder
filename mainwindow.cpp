#include "mainwindow.h"
#include <QMenuBar>
#include <QMenu>
#include <QPushButton>
#include <QLabel>
#include <QVBoxLayout>
#include <QWidget>

MainWindow::MainWindow(QWidget *parent)
    : QMainWindow(parent)
{
    menuBar()->addMenu("Files");//files menu
    menuBar()->addMenu("Edit");//edit
    menuBar()->addMenu("View");//view
    QWidget *central = new QWidget(this);
    setCentralWidget(central);
    QLabel *label = new QLabel("Hello Qt");
    QPushButton *button = new QPushButton("CLICK ME");//button
    button->setFixedSize(200, 50);
    QVBoxLayout *layout = new QVBoxLayout(central);
    layout->addWidget(label);
    layout->addWidget(button);
    layout->setSpacing(20);
    layout->setContentsMargins(20, 20, 20, 20);
    resize(900, 600);
}