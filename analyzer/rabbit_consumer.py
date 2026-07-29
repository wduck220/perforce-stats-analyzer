import pika
import json
import os
from analytics_pipeline import run_analytics_pipeline

QUEUE = 'analyzer.queue'
RABBITMQ_HOST = os.environ.get('RABBITMQ_HOST', 'localhost')


def callback(ch, method, properties, body):
    try:
        data = json.loads(body)
        print(f"[INFO] Получено сообщение, объектов: {len(data)}")

        period_from = data.get('period_from') if isinstance(data, dict) else None
        period_to = data.get('period_to') if isinstance(data, dict) else None
        submits = data.get('submits', data) if isinstance(data, dict) else data

        report = run_analytics_pipeline(
            submits,
            period_from=period_from,
            period_to=period_to,
        )

        if properties.reply_to:
            response_body = json.dumps(report, ensure_ascii=False, default=str)
            print(f"[DEBUG] Размер тела ответа: {len(response_body)} байт, reply_to={properties.reply_to}, correlation_id={properties.correlation_id}")
            print(f"[DEBUG] Ключи в report: {list(report.keys())}")
            ch.basic_publish(
                exchange='',
                routing_key=properties.reply_to,
                properties=pika.BasicProperties(correlation_id=properties.correlation_id, content_type='application/json'),
                body=response_body,
            )
            print("[DEBUG] Ответ опубликован.")
        else:
            print("[INFO] Сообщение без reply_to — работаем как раньше, fire-and-forget (например, плановая генерация по крону).")

        ch.basic_ack(delivery_tag=method.delivery_tag)

    except Exception as e:
        print(f"[Ошибка] Обработка сообщения: {e}")
        if properties.reply_to:
            try:
                ch.basic_publish(
                    exchange='',
                    routing_key=properties.reply_to,
                    properties=pika.BasicProperties(correlation_id=properties.correlation_id, content_type='application/json'),
                    body=json.dumps({'error': str(e)}, ensure_ascii=False),
                )
            except Exception as publish_err:
                print(f"[Ошибка] Не удалось отправить ответ об ошибке: {publish_err}")
        ch.basic_nack(delivery_tag=method.delivery_tag, requeue=False)


def start_consuming():
    try:
        connection = pika.BlockingConnection(pika.ConnectionParameters(RABBITMQ_HOST))
        channel = connection.channel()
        channel.queue_declare(queue=QUEUE, durable=True)
        channel.basic_qos(prefetch_count=1)
        print(f"[INFO] Подключено к RabbitMQ, очередь: {QUEUE}")
    except pika.exceptions.AMQPConnectionError as e:
        print(f"[Ошибка] Подключение к RabbitMQ: {e}")
        return

    channel.basic_consume(queue=QUEUE, on_message_callback=callback, auto_ack=False)
    print("Ожидание сообщений... (Ctrl+C для выхода)")
    try:
        channel.start_consuming()
    except KeyboardInterrupt:
        channel.stop_consuming()
    finally:
        connection.close()

if __name__ == "__main__":
    start_consuming()