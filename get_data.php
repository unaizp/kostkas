<?php
// get_data.php
// Proxy to fetch Google Sheets data without exposing the URL to the client.

// The Google Sheet ID (Hidden on the server side)
$sheetId = '165azi7XAeasx_Y4HzreEi7qQrJqbVgBCyTTKd69ipk0';
$url = "https://docs.google.com/spreadsheets/d/" . $sheetId . "/export?format=xlsx";

// Set headers to serve as an Excel file
header("Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
header("Content-Disposition: attachment; filename=data.xlsx");

// Fetch and output the file content
// Use curl for better reliability than file_get_contents
$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, $url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
curl_setopt($ch, CURLOPT_FOLLOWLOCATION, 1);
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
$data = curl_exec($ch);
$contentType = curl_getinfo($ch, CURLINFO_CONTENT_TYPE);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

// If request failed, or returned HTML (login page), or not 200 OK
if ($data === false || $httpCode !== 200 || strpos($contentType, 'text/html') !== false) {
    http_response_code(500);
    echo "Error fetching data: Invalid Content-Type ($contentType) or HTTP Code ($httpCode)";
} else {
    echo $data;
}
?>