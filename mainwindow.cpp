#include "mainwindow.h"

#include <QLabel>

MainWindow::MainWindow(QWidget *parent)
    : QMainWindow(parent)
{
    QLabel *label = new QLabel("Hello Qt", this);
    setCentralWidget(label);

    resize(900, 600);
}