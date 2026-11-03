#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>

// 1. Wi-Fi Settings
const char* ssid = "YOUR_WIFI_NAME";
const char* password = "YOUR_WIFI_PASSWORD";

// 2. EMQX Cloud Settings
const char* mqtt_server = "z7a0aa0f.ala.asia-southeast1.emqxsl.com";
const int mqtt_port = 8883; // Secure MQTT port
const char* mqtt_user = "Admin-Aeros";
const char* mqtt_pass = "aerosense123";

// 3. Your Device ID (Get this from your AeroSense Dashboard!)
const char* api_key = "mock-key-a763e2a9"; 

WiFiClientSecure espClient;
PubSubClient client(espClient);

void setup_wifi() {
  delay(10);
  Serial.println();
  Serial.print("Connecting to ");
  Serial.println(ssid);

  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println("");
  Serial.println("WiFi connected");
  Serial.print("IP address: ");
  Serial.println(WiFi.localIP());
}

void reconnect() {
  while (!client.connected()) {
    Serial.print("Attempting MQTT connection...");
    // Create a random client ID
    String clientId = "ESP32Client-";
    clientId += String(random(0, 0xffff), HEX);
    
    if (client.connect(clientId.c_str(), mqtt_user, mqtt_pass)) {
      Serial.println("connected to EMQX Cloud!");
    } else {
      Serial.print("failed, rc=");
      Serial.print(client.state());
      Serial.println(" try again in 5 seconds");
      delay(5000);
    }
  }
}

void setup() {
  Serial.begin(115200);
  setup_wifi();
  
  // Important: Skip checking the SSL certificate since we are on free tier cloud
  espClient.setInsecure(); 
  
  client.setServer(mqtt_server, mqtt_port);
}

void loop() {
  if (!client.connected()) {
    reconnect();
  }
  client.loop();

  // === READ YOUR REAL SENSORS HERE ===
  // For this example, we will generate fake data every 10 seconds
  float fake_pm25 = random(10, 60); // Normal is < 50
  float fake_voc = random(100, 350); // Normal is < 300
  
  // If we randomly trigger a massive vape cloud!
  if (random(0, 10) > 8) {
    fake_pm25 = random(150, 300);
    fake_voc = random(500, 900);
  }
  
  // Create JSON payload
  StaticJsonDocument<200> doc;
  doc["pm25"] = fake_pm25;
  doc["voc"] = fake_voc;
  doc["temperature"] = 24.5;
  doc["humidity"] = 45.0;

  char jsonBuffer[512];
  serializeJson(doc, jsonBuffer);

  // Send the payload to the unique topic for this device
  String topic = String("aerosense/") + api_key + "/readings";
  
  Serial.print("Sending to topic: ");
  Serial.println(topic);
  Serial.print("Payload: ");
  Serial.println(jsonBuffer);
  
  client.publish(topic.c_str(), jsonBuffer);

  // Wait 10 seconds before sending the next reading
  delay(10000);
}
