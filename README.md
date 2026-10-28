# SPECTRA — Outlier Detection Lab (Task 28)

A distinctive, responsive web application for exploring numerical data, drawing a box plot, and flagging potential outliers using the **1.5 × IQR rule**. The project includes a terminal-based Python analyzer that uses Pandas and Matplotlib to print a report and save a PNG box plot plus an outlier CSV.

## Task requirements covered

- Create a box plot for a numerical variable.
- Identify possible outliers outside the IQR whiskers.
- Provide a short explanation of the finding.
- Include suggested datasets: employee salaries and housing.
- Keep outliers flagged for review rather than removing them automatically.

## Project files

```text
outlier-detection-webapp/
├── index.html
├── styles.css
├── app.js
├── outlier_detector.py
├── requirements.txt
├── run_webapp.bat
├── run_analysis.bat
├── datasets/
│   ├── employee_salary.csv
│   └── housing.csv
└── output/
    └── .gitkeep
```

No Jupyter Notebook, Node.js, Flask, or other web framework is required. The website runs using Python's built-in HTTP server; its interactive CSV analysis and box plot are drawn in the browser. The terminal analyzer uses Pandas and Matplotlib.

## 1. Run the website on Windows

1. Download and extract the ZIP file.
2. Open the extracted `outlier-detection-webapp` folder.
3. Double-click `run_webapp.bat`.
4. Open **http://localhost:8000** if the browser does not launch automatically.
5. Use the dataset selector, change the numeric column, or choose **Upload CSV** to inspect your own file.
6. To stop the website, return to the terminal and press **Ctrl + C**.

**Important:** Use `run_webapp.bat` or a local server. Do not double-click `index.html`, because the browser may block loading the sample CSV files from the local file system.

## 2. Run outlier analysis in the terminal

Open the project folder in VS Code, then choose **Terminal → New Terminal**. Install the two required packages once:

```powershell
py -m pip install -r requirements.txt
```

Analyze the employee salary data:

```powershell
py outlier_detector.py datasets\employee_salary.csv --column Salary_INR
```

Analyze housing prices:

```powershell
py outlier_detector.py datasets\housing.csv --column Price_lakhs
```

Analyze a different numeric column, for example:

```powershell
py outlier_detector.py datasets\housing.csv --column Area_sqft
```

You can also double-click `run_analysis.bat` after the dependencies are installed. All output files are saved in `output/` by default:

- `boxplot_<column>.png` — Matplotlib box plot.
- `outliers_<column>.csv` — flagged records for further inspection.

The terminal program reports the number of rows, Q1, median, Q3, IQR, lower and upper fences, and each flagged CSV row.

## 3. How the outlier rule works

1. Calculate Q1 (25th percentile), median (50th percentile), and Q3 (75th percentile).
2. Calculate **IQR = Q3 − Q1**.
3. Lower fence = **Q1 − 1.5 × IQR**.
4. Upper fence = **Q3 + 1.5 × IQR**.
5. Any numeric observation below the lower fence or above the upper fence is flagged as a *potential* outlier. Box-plot whiskers extend to the most extreme observed values still within the fences.

The quartiles in this project use linear percentile interpolation. Small differences may occur versus tools that calculate quartiles differently. An outlier is not automatically an error: investigate the underlying record, units, measurement process, and domain context before deciding whether to retain, correct, or exclude it.

## 4. Uploading your own CSV

- The first row should contain column headers.
- At least one column should contain two or more numeric values.
- Choose a numeric variable from the **Numeric Variable** dropdown after uploading.
- The browser analyzes the chosen file locally in the page. The CSV is not sent to an external service.

## 5. Push to your GitHub profile

Your profile shown in the screenshot is `PranathiM15`.

1. Open **https://github.com/new** while signed in.
2. Repository name: `outlier-detection-webapp-task28`
3. Description: `Interactive outlier detection web app with IQR-based box plots using Python, Pandas and Matplotlib.`
4. Select **Public** if the task requires a public repository.
5. Leave **Add a README file**, `.gitignore`, and license unchecked because this project already contains its own README. Click **Create repository**.
6. Extract the ZIP and open the project folder in VS Code.
7. In **Terminal → New Terminal**, ensure the prompt is inside the `outlier-detection-webapp` folder and run these commands one at a time:

```powershell
git init
git add .
git commit -m "Build Task 28 outlier detection web app"
git branch -M main
git remote add origin https://github.com/PranathiM15/outlier-detection-webapp-task28.git
git push -u origin main
```

If Git asks for your identity, configure the name and email you use for GitHub, then retry the commit:

```powershell
git config --global user.name "Your GitHub Name"
git config --global user.email "your-github-email@example.com"
```

Replace the example email with your actual GitHub email. Do not share any password or access token.

### If you see `remote origin already exists`

Run:

```powershell
git remote -v
git remote set-url origin https://github.com/PranathiM15/outlier-detection-webapp-task28.git
git push -u origin main
```

### If `git` is not recognized

Git must be installed and available in PATH. Install Git for Windows from **https://git-scm.com/download/win**, then close and reopen VS Code and verify:

```powershell
git --version
```

If Git is installed but the terminal still cannot find it, reopen the terminal or restart VS Code before trying again.

## Interview questions — quick revision

**What is an outlier?** A value that differs substantially from the overall pattern of observations. Under the IQR rule, it is a value below Q1 − 1.5 × IQR or above Q3 + 1.5 × IQR.

**How does a box plot help?** It summarizes the median, quartiles, spread, and potential outliers so unusually distant observations are easy to inspect.

**Should every outlier be removed?** No. It may represent an error, a rare but valid case, or meaningful information. Investigate it before changing the data.
