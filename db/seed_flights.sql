use flight_planner;

CREATE TABLE `flights` (
  `id` int NOT NULL AUTO_INCREMENT,
  `airline` varchar(50) DEFAULT NULL,
  `flight_no` varchar(10) DEFAULT NULL,
  `source_airport` int DEFAULT NULL,
  `dest_airport` int DEFAULT NULL,
  `departure_time` time DEFAULT NULL,
  `arrival_time` time DEFAULT NULL,
  `duration` int DEFAULT NULL,
  `price` float DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `source_airport` (`source_airport`),
  KEY `dest_airport` (`dest_airport`),
  CONSTRAINT `flights_ibfk_1` FOREIGN KEY (`source_airport`) REFERENCES `airports` (`id`),
  CONSTRAINT `flights_ibfk_2` FOREIGN KEY (`dest_airport`) REFERENCES `airports` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=96 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `airports` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(100) DEFAULT NULL,
  `city` varchar(50) DEFAULT NULL,
  `country` varchar(50) DEFAULT NULL,
  `code` varchar(10) DEFAULT NULL,
  `latitude` float DEFAULT NULL,
  `longitude` float DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=66 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


INSERT INTO airports (id, name, city, country, code, latitude, longitude) VALUES
(1, 'Allama Iqbal International Airport', 'Lahore', 'Pakistan', 'LHE', 31.5216, 74.4036),
(2, 'Dubai International Airport', 'Dubai', 'UAE', 'DXB', 25.2532, 55.3657),
(3, 'Hamad International Airport', 'Doha', 'Qatar', 'DOH', 25.2611, 51.5651),
(4, 'Istanbul Airport', 'Istanbul', 'Turkey', 'IST', 41.2753, 28.7519),
(5, 'Frankfurt Airport', 'Frankfurt', 'Germany', 'FRA', 50.0379, 8.5622),
(6, 'John F. Kennedy Intl Airport', 'New York', 'USA', 'JFK', 40.6413, -73.7781),
(7, 'Midpoint Test Airport', 'MidCity', 'Nowhere', 'MID', 36.0, -10.0);


INSERT INTO flights (airline, flight_no, source_airport, dest_airport, departure_time, arrival_time, duration, price) VALUES
('PIA', 'PK201', 1, 2, '08:00:00', '10:30:00', 150, 200),
('Emirates', 'EK301', 2, 3, '12:00:00', '12:45:00', 45, 150),
('Qatar', 'QR501', 3, 6, '14:00:00', '22:00:00', 480, 250),
('Qatar', 'QR201', 1, 3, '09:00:00', '11:00:00', 120, 450),
('Qatar', 'QR503', 3, 6, '12:00:00', '20:00:00', 480, 750),
('Turkish', 'TK101', 1, 4, '10:00:00', '14:30:00', 270, 400),
('Turkish', 'TK601', 4, 6, '16:00:00', '22:00:00', 360, 700),
('PIA', 'PK999', 1, 6, '11:00:00', '23:00:00', 720, 1500),
('PIA', 'PK203', 1, 2, '08:30:00', '11:00:00', 150, 220),
('Emirates', 'EK501', 2, 6, '13:00:00', '21:00:00', 480, 500),
('PIA', 'PK205', 1, 2, '07:00:00', '09:30:00', 150, 250),
('Emirates', 'EK303', 2, 3, '11:00:00', '11:45:00', 45, 180),
('Qatar', 'QR401', 3, 4, '13:00:00', '17:30:00', 270, 350),
('Turkish', 'TK603', 4, 6, '19:00:00', '01:00:00', 360, 800),
('Emirates', 'EK401', 2, 4, '14:00:00', '18:00:00', 240, 400),
('Qatar', 'QR401', 3, 4, '12:00:00', '16:30:00', 270, 380),  -- duplicate flight_no if unique constraint exists
('Turkish', 'TK605', 4, 6, '18:00:00', '00:00:00', 360, 750);